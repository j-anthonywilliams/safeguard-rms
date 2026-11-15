import { createServerFn } from '@tanstack/react-start'
import { randomUUID } from 'node:crypto'
import { getDb } from '@/lib/db.server'
import { getCustomerContext } from '@/lib/customer-context.server'
import { requireRole } from '@/lib/authorization.server'

const ROLES = ['admin','backend'] as const
const fields = {
 payroll: ['employeeId','employee','contract','workDate','classification','scheduledHours','actualHours','variance','payRate','status'],
 billing: ['contract','workDate','classification','billableHours','billingRate','amount','status'],
} as const
const text = (v: unknown, max = 120) => String(v ?? '').trim().slice(0,max)
const date = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const number = (v: number) => Number.isFinite(v) && v >= 0
async function scope(){ const user=await requireRole([...ROLES]); const customer=await getCustomerContext();return {user,customer,db:getDb()} }

export const getPayrollBillingWorkspace = createServerFn({method:'GET'}).handler(async()=>{
 const {customer,db}=await scope()
 const [contracts,employees,profiles,entries]=await Promise.all([
  db.query<{id:string;name:string;active:boolean}>(`SELECT id,name,active FROM billing_contracts WHERE customer_id=$1 ORDER BY name`,[customer.id]),
  db.query<{id:string;name:string}>(`SELECT id,COALESCE(NULLIF(display_name,''),email) AS name FROM users WHERE is_archived=0 ORDER BY name LIMIT 500`),
  db.query<{id:string;name:string;kind:'payroll'|'billing';destination:string;columns:{key:string;header:string}[];delimiter:string;includeHeader:boolean;dateFormat:string}>(`SELECT id,name,kind,destination,columns,delimiter,include_header AS "includeHeader",date_format AS "dateFormat" FROM payroll_export_profiles WHERE customer_id=$1 ORDER BY name`,[customer.id]),
  db.query<{id:string;contractId:string;employeeId:string;workDate:string;classification:string;actualHours:number;billableHours:number;status:string}>(`SELECT id,contract_id AS "contractId",employee_id AS "employeeId",work_date::text AS "workDate",classification,actual_hours::float8 AS "actualHours",billable_hours::float8 AS "billableHours",status FROM payroll_work_entries WHERE customer_id=$1 ORDER BY work_date DESC LIMIT 300`,[customer.id]),
 ])
 return {contracts:contracts.rows,employees:employees.rows,profiles:profiles.rows,entries:entries.rows}
})
export const saveBillingContract = createServerFn({method:'POST'}).inputValidator((v:{name:string})=>v).handler(async({data})=>{
 const {customer,db}=await scope();const name=text(data.name);if(!name)throw new Error('Contract name required')
 await db.query(`INSERT INTO billing_contracts(id,customer_id,name) VALUES($1,$2,$3) ON CONFLICT(customer_id,name) DO NOTHING`,[randomUUID(),customer.id,name]);return {ok:true}
})
export const saveContractRate = createServerFn({method:'POST'}).inputValidator((v:{contractId:string;classification:'officer'|'supervisor'|'manager';billingRate:number;effectiveFrom:string})=>v).handler(async({data})=>{
 const {customer,db}=await scope();if(!fields.billing || !['officer','supervisor','manager'].includes(data.classification)||!number(data.billingRate)||!date(data.effectiveFrom))throw new Error('Invalid rate')
 const r=await db.query(`INSERT INTO billing_contract_rates(id,contract_id,classification,billing_rate,effective_from) SELECT $1,id,$2,$3,$4 FROM billing_contracts WHERE id=$5 AND customer_id=$6 ON CONFLICT(contract_id,classification,effective_from) DO UPDATE SET billing_rate=EXCLUDED.billing_rate RETURNING id`,[randomUUID(),data.classification,data.billingRate,data.effectiveFrom,data.contractId,customer.id]);if(!r.rowCount)throw new Error('Contract not found');return {ok:true}
})
export const saveEmployeePayRate = createServerFn({method:'POST'}).inputValidator((v:{contractId:string;employeeId:string;payRate:number;effectiveFrom:string})=>v).handler(async({data})=>{
 const {customer,db}=await scope();if(!number(data.payRate)||!date(data.effectiveFrom))throw new Error('Invalid rate')
 const r=await db.query(`INSERT INTO payroll_contract_pay_rates(id,contract_id,employee_id,pay_rate,effective_from) SELECT $1,c.id,u.id,$2,$3 FROM billing_contracts c JOIN users u ON u.id=$4 AND u.is_archived=0 WHERE c.id=$5 AND c.customer_id=$6 ON CONFLICT(contract_id,employee_id,effective_from) DO UPDATE SET pay_rate=EXCLUDED.pay_rate RETURNING id`,[randomUUID(),data.payRate,data.effectiveFrom,data.employeeId,data.contractId,customer.id]);if(!r.rowCount)throw new Error('Contract or employee not found');return {ok:true}
})
export const recordWorkedHours = createServerFn({method:'POST'}).inputValidator((v:{contractId:string;employeeId:string;workDate:string;classification:'officer'|'supervisor'|'manager';actualHours:number;billableHours:number})=>v).handler(async({data})=>{
 const {customer,user,db}=await scope();if(!date(data.workDate)||!['officer','supervisor','manager'].includes(data.classification)||!number(data.actualHours)||!number(data.billableHours)||data.actualHours>24||data.billableHours>24)throw new Error('Invalid hours')
 const r=await db.query(`INSERT INTO payroll_work_entries(id,customer_id,contract_id,employee_id,work_date,classification,actual_hours,billable_hours,created_by) SELECT $1,$2,c.id,u.id,$3,$4,$5,$6,$7 FROM billing_contracts c JOIN users u ON u.id=$8 AND u.is_archived=0 WHERE c.id=$9 AND c.customer_id=$2 RETURNING id`,[randomUUID(),customer.id,data.workDate,data.classification,data.actualHours,data.billableHours,user.id,data.employeeId,data.contractId]);if(!r.rowCount)throw new Error('Contract or employee not found');return {ok:true}
})
export const approveWorkedHours = createServerFn({method:'POST'}).inputValidator((v:{id:string})=>v).handler(async({data})=>{
 const {customer,user,db}=await scope();const r=await db.query(`UPDATE payroll_work_entries SET status='approved',approved_by=$1,approved_at=now() WHERE id=$2 AND customer_id=$3 AND status='pending' RETURNING id`,[user.id,data.id,customer.id]);if(!r.rowCount)throw new Error('Entry not found or already approved');return {ok:true}
})
export const saveExportProfile = createServerFn({method:'POST'}).inputValidator((v:{name:string;kind:'payroll'|'billing';destination:string;columns:{key:string;header:string}[];delimiter:string;includeHeader:boolean;dateFormat:'iso'|'us'})=>v).handler(async({data})=>{
 const {customer,user,db}=await scope();if(!['payroll','billing'].includes(data.kind))throw new Error('Invalid export type')
 const allowed:readonly string[]=fields[data.kind];if(!Array.isArray(data.columns)||!data.columns.length||data.columns.length>20||data.columns.some(c=>!allowed.includes(c.key)||!text(c.header,80)))throw new Error('Invalid columns')
 if(![',',';','\t'].includes(data.delimiter)||!['iso','us'].includes(data.dateFormat))throw new Error('Invalid format')
 const name=text(data.name);if(!name)throw new Error('Profile name required')
 await db.query(`INSERT INTO payroll_export_profiles(id,customer_id,name,kind,destination,columns,delimiter,include_header,date_format,created_by) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10) ON CONFLICT(customer_id,name,kind) DO UPDATE SET destination=EXCLUDED.destination,columns=EXCLUDED.columns,delimiter=EXCLUDED.delimiter,include_header=EXCLUDED.include_header,date_format=EXCLUDED.date_format`,[randomUUID(),customer.id,name,data.kind,text(data.destination,50),JSON.stringify(data.columns),data.delimiter,data.includeHeader,data.dateFormat,user.id]);return {ok:true}
})
export const previewExport = createServerFn({method:'POST'}).inputValidator((v:{profileId:string;from:string;to:string})=>v).handler(async({data})=>{
 const {customer,db}=await scope();if(!date(data.from)||!date(data.to)||data.from>data.to)throw new Error('Invalid period')
 const p=await db.query<{kind:'payroll'|'billing';columns:{key:string;header:string}[];delimiter:string;includeHeader:boolean;dateFormat:'iso'|'us';name:string}>(`SELECT kind,columns,delimiter,include_header AS "includeHeader",date_format AS "dateFormat",name FROM payroll_export_profiles WHERE id=$1 AND customer_id=$2`,[data.profileId,customer.id]);const profile=p.rows[0];if(!profile)throw new Error('Profile not found')
 const rows=await db.query<Record<string,string|number|null>>(`SELECT w.id,u.id AS "employeeId",COALESCE(NULLIF(u.display_name,''),u.email) AS employee,c.name AS contract,w.work_date::text AS "workDate",w.classification,w.actual_hours::float8 AS "actualHours",w.billable_hours::float8 AS "billableHours",w.status,COALESCE((SELECT r.pay_rate::float8 FROM payroll_contract_pay_rates r WHERE r.contract_id=c.id AND r.employee_id=u.id AND r.effective_from<=w.work_date AND (r.effective_to IS NULL OR r.effective_to>=w.work_date) ORDER BY r.effective_from DESC LIMIT 1),NULL) AS "payRate",COALESCE((SELECT r.billing_rate::float8 FROM billing_contract_rates r WHERE r.contract_id=c.id AND r.classification=w.classification AND r.effective_from<=w.work_date AND (r.effective_to IS NULL OR r.effective_to>=w.work_date) ORDER BY r.effective_from DESC LIMIT 1),NULL) AS "billingRate" FROM payroll_work_entries w JOIN billing_contracts c ON c.id=w.contract_id AND c.customer_id=w.customer_id JOIN users u ON u.id=w.employee_id WHERE w.customer_id=$1 AND w.work_date BETWEEN $2 AND $3 AND w.status='approved' ORDER BY w.work_date,u.email LIMIT 10000`,[customer.id,data.from,data.to]);
 const missing=rows.rows.filter(r=>profile.kind==='payroll'?r.payRate===null:r.billingRate===null).length
 if(missing)throw new Error(`${missing} approved entries lack an effective ${profile.kind==='payroll'?'pay':'billing'} rate`)
 const mapped=rows.rows.map(r=>({...r,scheduledHours:null,variance:null,amount:Number(r.billableHours)*Number(r.billingRate)}))
 return {profile,rows:mapped,warning:'Scheduled hours are not integrated yet; actual hours require approval before export. Provider import compatibility must be validated.'}
})

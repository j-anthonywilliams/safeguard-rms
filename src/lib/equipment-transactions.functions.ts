import { createServerFn } from '@tanstack/react-start'
import { getDb } from '@/lib/db.server'
import { getCustomerContext } from '@/lib/customer-context.server'
import { requireRole } from '@/lib/authorization.server'

const roles = ['user','supervisor','admin','backend'] as const
export const listEquipmentTransactions = createServerFn({method:'GET'}).handler(async()=>{
 await requireRole([...roles]);const customer=await getCustomerContext()
 const result=await getDb().query<{id:string;equipmentId:string;action:string;employeeId:string|null;actorId:string;conditionNote:string;createdAt:string}>(`SELECT id,equipment_id AS "equipmentId",action,employee_id AS "employeeId",actor_id AS "actorId",condition_note AS "conditionNote",created_at::text AS "createdAt" FROM equipment_transactions WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 100`,[customer.id]);return result.rows
})
export const listEquipmentEmployees = createServerFn({method:'GET'}).handler(async()=>{
 await requireRole([...roles]);const customer=await getCustomerContext()
 const result=await getDb().query<{id:string;displayName:string;email:string}>(`SELECT DISTINCT u.id,u.display_name AS "displayName",u.email FROM users u JOIN user_customer_assignments a ON a.user_id=u.id AND a.customer_id=$1 JOIN app_roles r ON r.user_id=u.id WHERE u.is_archived=0 AND r.role NOT IN ('support','backend') ORDER BY "displayName",u.email`,[customer.id]);return result.rows
})
export const transactEquipment = createServerFn({method:'POST'}).inputValidator((data:{equipmentId:string;action:'issue'|'return';employeeId?:string;conditionNote?:string})=>data).handler(async({data})=>{
 const user=await requireRole([...roles]);const customer=await getCustomerContext();const db=getDb();const client=await db.connect()
 try{await client.query('BEGIN');const item=await client.query<{id:string;status:string;assigned_to:string|null;user_id:string}>(`SELECT id,status,assigned_to,user_id FROM equipment WHERE id=$1 AND customer_id=$2 FOR UPDATE`,[data.equipmentId,customer.id]);const row=item.rows[0];if(!row)throw new Error('Equipment not found');if(!['admin','backend','supervisor'].includes(user.role)&&row.user_id!==user.id)throw new Error('Not authorized to manage this equipment')
 let employeeId:string|null=null
 if(data.action==='issue'){
  if(row.status!=='Available')throw new Error('Equipment is not available for issue');employeeId=(data.employeeId||'').trim();if(!employeeId)throw new Error('Select an employee')
  const employee=await client.query(`SELECT u.id FROM users u JOIN app_roles r ON r.user_id=u.id WHERE u.id=$1 AND u.is_archived=0 AND r.role NOT IN ('support','backend') AND EXISTS(SELECT 1 FROM user_customer_assignments a WHERE a.user_id=u.id AND a.customer_id=$2)`,[employeeId,customer.id]);if(!employee.rowCount)throw new Error('Employee is not assigned to this customer')
  await client.query(`UPDATE equipment SET status='Issued',assigned_to=$1,updated_at=$2 WHERE id=$3 AND customer_id=$4`,[employeeId,new Date().toISOString(),row.id,customer.id])
 }else{
  if(row.status!=='Issued')throw new Error('Equipment is not currently issued');employeeId=row.assigned_to;await client.query(`UPDATE equipment SET status='Available',assigned_to='',updated_at=$1 WHERE id=$2 AND customer_id=$3`,[new Date().toISOString(),row.id,customer.id])
 }
 await client.query(`INSERT INTO equipment_transactions(id,customer_id,equipment_id,action,employee_id,actor_id,condition_note) VALUES($1,$2,$3,$4,$5,$6,$7)`,[crypto.randomUUID(),customer.id,row.id,data.action,employeeId,user.id,(data.conditionNote||'').trim().slice(0,1000)]);await client.query('COMMIT');return {ok:true}
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
})

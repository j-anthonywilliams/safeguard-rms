import { createServerFn } from '@tanstack/react-start'
import { getDb } from '@/lib/db.server'
import { requireActiveUser, requireRole } from '@/lib/authorization.server'
import { getCustomerContext } from '@/lib/customer-context.server'

const managers = ['office_staff', 'supervisor', 'admin', 'backend'] as const
const reviewers = ['supervisor', 'admin', 'backend'] as const
const trim = (value: string, max: number) => value.trim().slice(0, max)
const id = () => crypto.randomUUID()

async function audit(customerId: string, actorId: string, kind: string, recordId: string, action: string, note = '') {
  await getDb().query(`INSERT INTO personnel_workflow_audit (id, customer_id, actor_id, record_type, record_id, action, note) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id(),customerId,actorId,kind,recordId,action,note])
}

export const getPersonnelWorkspace = createServerFn({method:'GET'}).handler(async () => {
  const user = await requireActiveUser()
  if (user.role === 'investigator') throw new Error('Investigator cannot access personnel data')
  const customer = await getCustomerContext()
  const db = getDb()
  const manager = (managers as readonly string[]).includes(user.role)
  const reviewer = (reviewers as readonly string[]).includes(user.role)
  const [classes, assignments, candidates, steps, reports, timeOff] = await Promise.all([
    db.query<{id:string;title:string;description:string;prerequisites:string;content:string;recurrenceDays:number|null;expirationDays:number|null;passingScore:number|null}>(`SELECT id,title,description,prerequisites,content,recurrence_days AS "recurrenceDays",expiration_days AS "expirationDays",passing_score AS "passingScore" FROM personnel_training_classes WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 200`,[customer.id]),
    db.query<{id:string;classId:string;userId:string;status:string}>(`SELECT id,class_id AS "classId",user_id AS "userId",status FROM personnel_training_assignments WHERE customer_id=$1 AND ($2 OR user_id=$3) ORDER BY assigned_at DESC LIMIT 500`,[customer.id,manager,user.id]),
    db.query<{id:string;userId:string;fullName:string;email:string;stage:string}>(`SELECT id,user_id AS "userId",full_name AS "fullName",email,stage FROM personnel_candidates WHERE customer_id=$1 AND ($2 OR user_id=$3) ORDER BY created_at DESC LIMIT 200`,[customer.id,manager,user.id]),
    db.query<{id:string;candidateId:string;title:string;completedAt:string|null}>(`SELECT s.id,s.candidate_id AS "candidateId",s.title,s.completed_at AS "completedAt" FROM personnel_onboarding_steps s JOIN personnel_candidates c ON c.id=s.candidate_id AND c.customer_id=s.customer_id WHERE s.customer_id=$1 AND ($2 OR c.user_id=$3) ORDER BY s.created_at LIMIT 500`,[customer.id,manager,user.id]),
    db.query<{id:string;title:string;narrative:string;status:string;authorId:string;subjectUserId:string|null}>(`SELECT id,title,narrative,status,author_id AS "authorId",subject_user_id AS "subjectUserId" FROM personnel_administrative_reports WHERE customer_id=$1 AND ($2 OR author_id=$3) ORDER BY created_at DESC LIMIT 200`,[customer.id,manager,user.id]),
    db.query<{id:string;userId:string;startDate:string;endDate:string;reason:string;status:string}>(`SELECT id,user_id AS "userId",start_date::text AS "startDate",end_date::text AS "endDate",reason,status FROM personnel_time_off_requests WHERE customer_id=$1 AND ($2 OR user_id=$3) ORDER BY created_at DESC LIMIT 200`,[customer.id,reviewer,user.id]),
  ])
  return {role:user.role,userId:user.id,classes:classes.rows,assignments:assignments.rows,candidates:candidates.rows,steps:steps.rows,reports:reports.rows,timeOff:timeOff.rows}
})

export const createTrainingClass = createServerFn({method:'POST'})
 .inputValidator((data:{title:string;description:string;prerequisites:string;content:string;recurrenceDays:number|null;expirationDays:number|null;passingScore:number|null})=>data)
 .handler(async ({data})=>{
   const user=await requireRole([...managers]); const customer=await getCustomerContext()
   const title=trim(data.title,160); if(!title) throw new Error('Class title required')
   for(const days of [data.recurrenceDays,data.expirationDays]) if(days!==null && (!Number.isInteger(days)||days<=0||days>36500)) throw new Error('Invalid interval')
   if(data.passingScore!==null && (!Number.isInteger(data.passingScore)||data.passingScore<0||data.passingScore>100)) throw new Error('Invalid passing score')
   const key=id()
   await getDb().query(`INSERT INTO personnel_training_classes (id,customer_id,title,description,prerequisites,content,recurrence_days,expiration_days,passing_score,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[key,customer.id,title,trim(data.description,5000),trim(data.prerequisites,5000),trim(data.content,20000),data.recurrenceDays,data.expirationDays,data.passingScore,user.id])
   await audit(customer.id,user.id,'training_class',key,'created');return {id:key}
 })

export const assignTraining = createServerFn({method:'POST'})
 .inputValidator((data:{classId:string;userId:string})=>data)
 .handler(async ({data})=>{
   const user=await requireRole([...managers]);const customer=await getCustomerContext();const db=getDb()
   const result=await db.query(`INSERT INTO personnel_training_assignments (id,customer_id,class_id,user_id) SELECT $1,$2,c.id,u.id FROM personnel_training_classes c JOIN users u ON u.id=$4 AND COALESCE(u.is_archived,0)=0 WHERE c.id=$3 AND c.customer_id=$2 ON CONFLICT(customer_id,class_id,user_id) DO NOTHING RETURNING id`,[id(),customer.id,data.classId,data.userId]);if(!result.rowCount) throw new Error('Assignment unavailable or already exists')
   await audit(customer.id,user.id,'training_class',data.classId,'assigned',data.userId);return {ok:true}
 })

export const verifyTraining = createServerFn({method:'POST'})
 .inputValidator((data:{assignmentId:string})=>data)
 .handler(async ({data})=>{
   const user=await requireRole([...managers]);const customer=await getCustomerContext()
   const result=await getDb().query(`UPDATE personnel_training_assignments SET status='completed',completed_at=now(),verified_by=$3 WHERE id=$1 AND customer_id=$2 AND status='assigned' RETURNING id`,[data.assignmentId,customer.id,user.id]);if(!result.rowCount) throw new Error('Assignment not found or completed')
   await audit(customer.id,user.id,'training_assignment',data.assignmentId,'manually_verified');return {ok:true}
 })

export const addCandidate = createServerFn({method:'POST'})
 .inputValidator((data:{fullName:string;email:string})=>data)
 .handler(async ({data})=>{
   const user=await requireRole(['office_staff','admin','backend']);const customer=await getCustomerContext();const db=getDb()
   const email=trim(data.email.toLowerCase(),254);const name=trim(data.fullName,160)
   if(!name||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Valid name and email required')
   // Candidates get a disabled/unassigned customer identity. No app role or membership is granted.
   const existing=await db.query<{id:string}>(`SELECT id FROM users WHERE lower(email)=$1 LIMIT 1`,[email])
   if(existing.rows.length) throw new Error('User already exists; link existing users through the future candidate reconciliation workflow')
   const userId=id();const candidateId=id();const client=await db.connect()
   try {await client.query('BEGIN');await client.query(`INSERT INTO users (id,email,display_name,is_archived,created_at,updated_at,last_sign_in) VALUES ($1,$2,$3,1,$4,$4,$4)`,[userId,email,name,new Date().toISOString()]);await client.query(`INSERT INTO personnel_candidates (id,customer_id,user_id,full_name,email,created_by) VALUES ($1,$2,$3,$4,$5,$6)`,[candidateId,customer.id,userId,name,email,user.id]);await client.query('COMMIT')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
   await audit(customer.id,user.id,'candidate',candidateId,'created');return {id:candidateId}
 })

export const addOnboardingStep = createServerFn({method:'POST'})
 .inputValidator((data:{candidateId:string;title:string})=>data)
 .handler(async ({data})=>{
   const user=await requireRole(['office_staff','admin','backend']);const customer=await getCustomerContext();const title=trim(data.title,200);if(!title)throw new Error('Step title required')
   const key=id();const result=await getDb().query(`INSERT INTO personnel_onboarding_steps (id,customer_id,candidate_id,title) SELECT $1,$2,id,$4 FROM personnel_candidates WHERE id=$3 AND customer_id=$2 RETURNING id`,[key,customer.id,data.candidateId,title]);if(!result.rowCount)throw new Error('Candidate not found')
   await audit(customer.id,user.id,'onboarding_step',key,'created');return {id:key}
 })

export const completeOnboardingStep = createServerFn({method:'POST'})
 .inputValidator((data:{stepId:string})=>data)
 .handler(async ({data})=>{
   const user=await requireRole(['office_staff','admin','backend']);const customer=await getCustomerContext()
   const result=await getDb().query(`UPDATE personnel_onboarding_steps SET completed_at=now(),completed_by=$3 WHERE id=$1 AND customer_id=$2 AND completed_at IS NULL RETURNING id`,[data.stepId,customer.id,user.id]);if(!result.rowCount)throw new Error('Step unavailable')
   await audit(customer.id,user.id,'onboarding_step',data.stepId,'manually_verified');return {ok:true}
 })

export const createAdministrativeReport = createServerFn({method:'POST'})
 .inputValidator((data:{title:string;narrative:string;subjectUserId:string|null})=>data)
 .handler(async ({data})=>{
   const user=await requireRole([...managers]);const customer=await getCustomerContext();const title=trim(data.title,180);const narrative=trim(data.narrative,30000)
   if(!title||!narrative)throw new Error('Title and narrative required')
   const key=id();await getDb().query(`INSERT INTO personnel_administrative_reports (id,customer_id,subject_user_id,author_id,title,narrative) VALUES ($1,$2,$3,$4,$5,$6)`,[key,customer.id,data.subjectUserId||null,user.id,title,narrative]);await audit(customer.id,user.id,'administrative_report',key,'submitted');return {id:key}
 })

export const reviewPersonnelRequest = createServerFn({method:'POST'})
 .inputValidator((data:{kind:'administrative_report'|'time_off';id:string;decision:'approved'|'rejected';note:string})=>data)
 .handler(async ({data})=>{
   const user=await requireRole([...reviewers]);const customer=await getCustomerContext();const table=data.kind==='time_off'?'personnel_time_off_requests':'personnel_administrative_reports';const note=trim(data.note,5000)
   if(data.decision==='rejected'&&!note)throw new Error('Rejection reason required')
   const result=await getDb().query(`UPDATE ${table} SET status=$1,reviewer_id=$2,review_note=$3,reviewed_at=now() WHERE id=$4 AND customer_id=$5 AND status='pending' RETURNING id`,[data.decision,user.id,note,data.id,customer.id]);if(!result.rowCount)throw new Error('Pending record not found')
   await audit(customer.id,user.id,data.kind,data.id,data.decision,note);return {ok:true}
 })

export const requestTimeOff = createServerFn({method:'POST'})
 .inputValidator((data:{startDate:string;endDate:string;reason:string})=>data)
 .handler(async ({data})=>{
   const user=await requireActiveUser();if(user.role==='investigator')throw new Error('Investigator cannot access personnel data');const customer=await getCustomerContext()
   if(!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(data.endDate)||data.endDate<data.startDate)throw new Error('Valid date range required')
   const key=id();await getDb().query(`INSERT INTO personnel_time_off_requests (id,customer_id,user_id,start_date,end_date,reason) VALUES ($1,$2,$3,$4,$5,$6)`,[key,customer.id,user.id,data.startDate,data.endDate,trim(data.reason,2000)]);await audit(customer.id,user.id,'time_off',key,'submitted');return {id:key}
 })

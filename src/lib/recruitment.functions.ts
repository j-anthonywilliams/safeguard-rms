import { createServerFn } from '@tanstack/react-start'
import { getDb } from '@/lib/db.server'
import { getCustomerContext } from '@/lib/customer-context.server'
import { requireRole } from '@/lib/authorization.server'

const uid = () => crypto.randomUUID()
const clean = (v: string, max: number) => (v || '').trim().slice(0, max)
const hiringRoles = ['office_staff', 'admin', 'backend'] as const
export type ApplicationDetails = { phone:string; address:string; city:string; state:string; postalCode:string; preferredShifts:string[]; availableDays:string[]; startDate:string; workAuthorized:boolean; sponsorshipRequired:boolean; employmentHistory:{employer:string;title:string;start:string;end:string;description:string}[]; educationHistory:{institution:string;qualification:string;field:string;completion:string}[]; licenses:{name:string;issuer:string;number:string;expires:string}[]; references:{name:string;relationship:string;contact:string}[]; certificationAccepted:boolean }
const phases = ['application_received','application_review','interview','conditional_offer','pre_employment','final_offer','onboarding','employee_activation'] as const

export const listRecruitment = createServerFn({ method: 'GET' }).handler(async () => {
  await requireRole([...hiringRoles]); const customer = await getCustomerContext(); const db = getDb()
  const [postings, applications] = await Promise.all([
    db.query<{id:string;slug:string;title:string;status:string;description:string;expiresAt:string|null;onboardingJobTitle:string}>(`SELECT id,slug,title,status,description,expires_at::text AS "expiresAt",onboarding_job_title AS "onboardingJobTitle" FROM personnel_job_postings WHERE customer_id=$1 ORDER BY created_at DESC`,[customer.id]),
    db.query<{id:string;postingId:string;candidateId:string;fullName:string;email:string;title:string;stage:string;disposition:string;followUpOn:string|null;applicationDetails:ApplicationDetails|null}>(`SELECT a.id,a.posting_id AS "postingId",a.candidate_id AS "candidateId",c.full_name AS "fullName",c.email,p.title,a.stage,a.disposition,a.follow_up_on::text AS "followUpOn",a.application_data AS "applicationDetails" FROM personnel_job_applications a JOIN personnel_candidates c ON c.id=a.candidate_id AND c.customer_id=a.customer_id JOIN personnel_job_postings p ON p.id=a.posting_id AND p.customer_id=a.customer_id WHERE a.customer_id=$1 ORDER BY a.updated_at DESC LIMIT 500`,[customer.id]),
  ])
  return {postings:postings.rows,applications:applications.rows,phases:[...phases]}
})

export const createJobPosting = createServerFn({method:'POST'})
 .inputValidator((data:{title:string;description:string;qualifications:string;location:string;employmentType:string;compensation:string;onboardingJobTitle:string;expirationDays?:number})=>data)
 .handler(async ({data})=>{
  const user=await requireRole([...hiringRoles]);const customer=await getCustomerContext()
  const title=clean(data.title,160);if(!title)throw new Error('Job title required')
  const slug=`${title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)}-${uid().slice(0,8)}`
  const days=Number(data.expirationDays??30);if(!Number.isInteger(days)||days<1||days>365)throw new Error("Expiration must be 1 to 365 days")
  const key=uid();await getDb().query(`INSERT INTO personnel_job_postings(id,customer_id,slug,title,description,qualifications,location,employment_type,compensation,onboarding_job_title,created_by,posting_duration_days) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[key,customer.id,slug,title,clean(data.description,10000),clean(data.qualifications,5000),clean(data.location,200),clean(data.employmentType,80),clean(data.compensation,120),clean(data.onboardingJobTitle,160)||title,user.id,days]);return {id:key,slug}
 })

export const setJobPostingStatus = createServerFn({method:'POST'})
 .inputValidator((data:{id:string;status:'draft'|'published'|'closed'|'archived'})=>data)
 .handler(async ({data})=>{
  await requireRole([...hiringRoles]);const customer=await getCustomerContext()
  const r=await getDb().query(`UPDATE personnel_job_postings SET status=$1,expires_at=CASE WHEN $1='published' THEN now() + (posting_duration_days * interval '1 day') ELSE expires_at END WHERE id=$2 AND customer_id=$3 RETURNING id`,[data.status,data.id,customer.id]);if(!r.rowCount)throw new Error('Job not found');return {ok:true}
 })

export const getPublicJob = createServerFn({method:'GET'})
 .inputValidator((data:{slug:string})=>data)
 .handler(async ({data})=>{
  const customer=await getCustomerContext()
  const result=await getDb().query<{id:string;title:string;description:string;qualifications:string;location:string;employmentType:string;compensation:string}>(`SELECT id,title,description,qualifications,location,employment_type AS "employmentType",compensation FROM personnel_job_postings WHERE customer_id=$1 AND slug=$2 AND status='published' AND (expires_at IS NULL OR expires_at>now()) LIMIT 1`,[customer.id,clean(data.slug,100)])
  if(!result.rows[0])throw new Error('This position is not accepting applications')
  return result.rows[0]
 })

export const submitPublicApplication = createServerFn({method:'POST'})
 .inputValidator((data:{slug:string;fullName:string;email:string;coverNote:string;website?:string;details:ApplicationDetails})=>data)
 .handler(async ({data})=>{
  // Honeypot is only one layer; production should add IP throttling and abuse monitoring.
  if(data.website)throw new Error('Unable to submit application')
  const name=clean(data.fullName,160),email=clean(data.email.toLowerCase(),254)
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Valid name and email required')
  const details=data.details
  if(!details||!details.certificationAccepted||!details.phone?.trim()||!details.address?.trim()||!details.city?.trim()||!details.state?.trim()||!details.postalCode?.trim()||typeof details.workAuthorized!=='boolean'||typeof details.sponsorshipRequired!=='boolean')throw new Error('Complete required application fields and certification')
  const safeDetails:ApplicationDetails={phone:clean(details.phone,40),address:clean(details.address,200),city:clean(details.city,100),state:clean(details.state,80),postalCode:clean(details.postalCode,25),preferredShifts:(details.preferredShifts||[]).slice(0,8).map(v=>clean(v,40)),availableDays:(details.availableDays||[]).slice(0,7).map(v=>clean(v,20)),startDate:clean(details.startDate,10),workAuthorized:details.workAuthorized,sponsorshipRequired:details.sponsorshipRequired,employmentHistory:(details.employmentHistory||[]).slice(0,12).map(v=>({employer:clean(v.employer,160),title:clean(v.title,160),start:clean(v.start,20),end:clean(v.end,20),description:clean(v.description,1500)})),educationHistory:(details.educationHistory||[]).slice(0,12).map(v=>({institution:clean(v.institution,160),qualification:clean(v.qualification,160),field:clean(v.field,160),completion:clean(v.completion,20)})),licenses:(details.licenses||[]).slice(0,20).map(v=>({name:clean(v.name,160),issuer:clean(v.issuer,160),number:clean(v.number,100),expires:clean(v.expires,20)})),references:(details.references||[]).slice(0,8).map(v=>({name:clean(v.name,160),relationship:clean(v.relationship,100),contact:clean(v.contact,160)})),certificationAccepted:true}
  if(JSON.stringify(safeDetails).length>25000)throw new Error('Application exceeds size limit')
  const customer=await getCustomerContext(),db=getDb(),client=await db.connect()
  try {
   await client.query('BEGIN')
   const posting=await client.query<{id:string;created_by:string;onboarding_job_title:string}>(`SELECT id,created_by,onboarding_job_title FROM personnel_job_postings WHERE customer_id=$1 AND slug=$2 AND status='published' AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE`,[customer.id,clean(data.slug,100)])
   const job=posting.rows[0];if(!job)throw new Error('Position is not accepting applications')
   // Prevent duplicate applications; existing user identities are not automatically granted access.
   const existing=await client.query<{id:string}>(`SELECT id FROM users WHERE lower(email)=$1 LIMIT 1`,[email])
   if(existing.rows.length)throw new Error('An account with this email already exists. Contact the hiring office.')
   const userId=uid(),candidateId=uid(),applicationId=uid(),now=new Date().toISOString()
   await client.query(`INSERT INTO users(id,email,display_name,is_archived,created_at,updated_at,last_sign_in) VALUES($1,$2,$3,1,$4,$4,$4)`,[userId,email,name,now])
   await client.query(`INSERT INTO personnel_candidates(id,customer_id,user_id,full_name,email,created_by,job_title,stage) VALUES($1,$2,$3,$4,$5,$6,$7,'application_received')`,[candidateId,customer.id,userId,name,email,job.created_by,job.onboarding_job_title])
   await client.query(`INSERT INTO personnel_job_applications(id,customer_id,posting_id,candidate_id,cover_note,application_data) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[applicationId,customer.id,job.id,candidateId,clean(data.coverNote,5000),JSON.stringify(safeDetails)])
   await client.query(`INSERT INTO personnel_onboarding_steps(id,customer_id,candidate_id,title,requirement_kind,required,source_template_id) SELECT md5($1::text||r.id),$2,$1,r.title,r.kind,r.required,t.id FROM personnel_onboarding_templates t JOIN personnel_onboarding_template_requirements r ON r.template_id=t.id WHERE t.customer_id=$2 AND t.active=true AND (t.job_title IS NULL OR lower(t.job_title)=lower($3))`,[candidateId,customer.id,job.onboarding_job_title])
   await client.query(`INSERT INTO personnel_application_events(id,customer_id,application_id,action,note) VALUES($1,$2,$3,'submitted','Public application')`,[uid(),customer.id,applicationId])
   await client.query('COMMIT');return {ok:true}
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 })

export const changeApplicationStage = createServerFn({method:'POST'})
 .inputValidator((data:{applicationId:string;action:'advance'|'defer'|'reject'|'reactivate';reason?:string;followUpOn?:string})=>data)
 .handler(async ({data})=>{
  const actor=await requireRole([...hiringRoles]);const customer=await getCustomerContext(),db=getDb(),client=await db.connect()
  const reason=clean(data.reason||'',2000)
  if((data.action==='reject'||data.action==='defer')&&!reason)throw new Error('Reason is required')
  try{
   await client.query('BEGIN')
   const r=await client.query<{id:string;candidate_id:string;stage:string;disposition:string;email:string;full_name:string}>(`SELECT a.id,a.candidate_id,a.stage,a.disposition,c.email,c.full_name FROM personnel_job_applications a JOIN personnel_candidates c ON c.id=a.candidate_id AND c.customer_id=a.customer_id WHERE a.id=$1 AND a.customer_id=$2 FOR UPDATE OF a`,[data.applicationId,customer.id]);const a=r.rows[0]
   if(!a)throw new Error('Application not found')
   let stage=a.stage,disposition=a.disposition
   if(data.action==='advance'){
    if(disposition!=='active')throw new Error('Reactivate the application first')
    const idx=phases.indexOf(stage as typeof phases[number]);if(idx<0||idx===phases.length-1)throw new Error('No next phase')
    stage=phases[idx+1]
    if(stage==='final_offer'||stage==='employee_activation'){
      const remaining=await client.query(`SELECT COUNT(*)::int AS count FROM personnel_onboarding_steps WHERE customer_id=$1 AND candidate_id=$2 AND required=true AND completed_at IS NULL`,[customer.id,a.candidate_id]);if(Number(remaining.rows[0].count)>0)throw new Error('Required onboarding steps are incomplete')
    }
   }else if(data.action==='defer'){
    if(disposition!=='active')throw new Error('Application is not active');disposition='deferred'
   }else if(data.action==='reject'){
    if(disposition==='rejected')throw new Error('Already rejected');disposition='rejected'
   }else if(data.action==='reactivate'){
    if(disposition!=='deferred')throw new Error('Only deferred applications may be reactivated');disposition='active'
   }
   const followUp=data.action==='defer'&&/^\d{4}-\d{2}-\d{2}$/.test(data.followUpOn||'')?data.followUpOn:null
   await client.query(`UPDATE personnel_job_applications SET stage=$1,disposition=$2,internal_reason=$3,follow_up_on=$4,updated_at=now() WHERE id=$5 AND customer_id=$6`,[stage,disposition,reason,followUp,a.id,customer.id])
   await client.query(`UPDATE personnel_candidates SET stage=$1 WHERE id=$2 AND customer_id=$3`,[disposition==='active'?stage:disposition,a.candidate_id,customer.id])
   await client.query(`INSERT INTO personnel_application_events(id,customer_id,application_id,actor_id,action,from_stage,to_stage,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uid(),customer.id,a.id,actor.id,data.action,a.stage,stage,reason])
   if(data.action==='reject'){
    // Queue, do not claim delivered. A configured outbox worker must send the letter.
    await client.query(`INSERT INTO notification_outbox(id,customer_id,notification_type,reference_id,recipient_user_id,recipient_email,payload) SELECT $1,$2,'candidate_rejection',$3,c.user_id,c.email,$4::jsonb FROM personnel_candidates c WHERE c.id=$5 AND c.customer_id=$2`,[uid(),customer.id,a.id,JSON.stringify({subject:'Your employment application',body:`Thank you for your interest in the position. We will not be moving forward with your application at this time. We appreciate your time and interest.`}),a.candidate_id])
   }
   await client.query('COMMIT');return {ok:true,notificationQueued:data.action==='reject'}
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 })

// Interview scheduling is scoped to the current customer; deferred applicants remain selectable.
export const listRecruitmentInterviews = createServerFn({method:'GET'}).handler(async()=>{
 await requireRole([...hiringRoles]);const customer=await getCustomerContext()
 const result=await getDb().query<{id:string;applicationId:string;scheduledAt:string;interviewer:string;notes:string;fullName:string;disposition:string}>(`SELECT i.id,i.application_id AS "applicationId",i.scheduled_at::text AS "scheduledAt",i.interviewer,i.notes,c.full_name AS "fullName",a.disposition FROM personnel_interviews i JOIN personnel_job_applications a ON a.id=i.application_id AND a.customer_id=i.customer_id JOIN personnel_candidates c ON c.id=a.candidate_id AND c.customer_id=a.customer_id WHERE i.customer_id=$1 ORDER BY i.scheduled_at DESC LIMIT 200`,[customer.id]);return result.rows
})
export const scheduleRecruitmentInterview = createServerFn({method:'POST'})
 .inputValidator((data:{applicationId:string;scheduledAt:string;interviewer:string;notes:string})=>data)
 .handler(async({data})=>{
 const actor=await requireRole([...hiringRoles]);const customer=await getCustomerContext();const db=getDb()
 const date=new Date(data.scheduledAt);if(!Number.isFinite(date.getTime()))throw new Error('Valid interview date required')
 const candidate=await db.query(`SELECT id FROM personnel_job_applications WHERE id=$1 AND customer_id=$2 AND disposition IN ('active','deferred')`,[data.applicationId,customer.id]);if(!candidate.rowCount)throw new Error('Candidate not eligible for interview')
 const id=uid();await db.query(`INSERT INTO personnel_interviews(id,customer_id,application_id,scheduled_at,interviewer,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,customer.id,data.applicationId,date.toISOString(),clean(data.interviewer,160),clean(data.notes,2000),actor.id]);return {id}
 })

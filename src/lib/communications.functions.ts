import { createServerFn } from '@tanstack/react-start'
import { getDb } from './db.server'
import { getCustomerContext } from './customer-context.server'
import { requireActiveUser } from './authorization.server'

const canAnnounce = (role: string) => ['supervisor','admin','backend'].includes(role)

export const listCommunicationRecipients = createServerFn({method:'GET'}).handler(async () => {
  const actor = await requireActiveUser()
  const customer = await getCustomerContext()
  const result = await getDb().query<{id:string;name:string;email:string}>(`
    SELECT u.id, COALESCE(NULLIF(u.display_name,''),u.email) AS name,u.email
    FROM users u JOIN user_customer_assignments a ON a.user_id=u.id
    WHERE a.customer_id=$1 AND u.is_archived=0 AND u.id<>$2
    ORDER BY name LIMIT 1000`,[customer.id,actor.id])
  return result.rows
})

export const listCommunications = createServerFn({method:'GET'}).handler(async () => {
  const actor=await requireActiveUser(); const customer=await getCustomerContext()
  const db=getDb()
  const [inbox,sent,unread]=await Promise.all([
    db.query<{id:string;kind:string;subject:string;body:string;senderName:string;createdAt:string;readAt:string|null}>(`
      SELECT m.id,m.kind,m.subject,m.body,COALESCE(u.display_name,u.email) AS "senderName",m.created_at::text AS "createdAt",r.read_at::text AS "readAt"
      FROM communication_recipients r JOIN communication_messages m ON m.id=r.message_id AND m.customer_id=r.customer_id
      JOIN users u ON u.id=m.sender_id
      WHERE r.customer_id=$1 AND r.user_id=$2 ORDER BY m.created_at DESC LIMIT 200`,[customer.id,actor.id]),
    db.query<{id:string;kind:string;subject:string;body:string;createdAt:string;recipientCount:number}>(`
      SELECT m.id,m.kind,m.subject,m.body,m.created_at::text AS "createdAt",count(r.user_id)::int AS "recipientCount"
      FROM communication_messages m LEFT JOIN communication_recipients r ON r.message_id=m.id AND r.customer_id=m.customer_id
      WHERE m.customer_id=$1 AND m.sender_id=$2 GROUP BY m.id ORDER BY m.created_at DESC LIMIT 100`,[customer.id,actor.id]),
    db.query<{count:number}>(`SELECT count(*)::int AS count FROM communication_recipients WHERE customer_id=$1 AND user_id=$2 AND read_at IS NULL`,[customer.id,actor.id]),
  ])
  return {inbox:inbox.rows,sent:sent.rows,unread:unread.rows[0]?.count??0,canAnnounce:canAnnounce(actor.role)}
})

export const sendCommunication = createServerFn({method:'POST'}).inputValidator((data:{kind:'direct'|'announcement';recipientId?:string;subject:string;body:string})=>data).handler(async ({data})=>{
  const actor=await requireActiveUser();const customer=await getCustomerContext();const db=getDb()
  const subject=data.subject?.trim();const body=data.body?.trim()
  if(!subject||subject.length>200||!body||body.length>10000)throw new Error('Subject (1–200) and message (1–10000) are required')
  if(data.kind!=='direct'&&data.kind!=='announcement')throw new Error('Invalid message type')
  if(data.kind==='announcement'&&!canAnnounce(actor.role))throw new Error('Announcement permission required')
  const client=await db.connect()
  try{
    await client.query('BEGIN')
    const ids=await client.query<{id:string}>(data.kind==='direct'
      ? `SELECT u.id FROM users u JOIN user_customer_assignments a ON a.user_id=u.id AND a.customer_id=$1 WHERE u.id=$2 AND u.is_archived=0 AND u.id<>$3`
      : `SELECT u.id FROM users u JOIN user_customer_assignments a ON a.user_id=u.id AND a.customer_id=$1 WHERE u.is_archived=0 AND u.id<>$2`,
      data.kind==='direct'?[customer.id,data.recipientId??'',actor.id]:[customer.id,actor.id])
    if(!ids.rows.length)throw new Error('No eligible recipients')
    const id=crypto.randomUUID()
    await client.query(`INSERT INTO communication_messages(id,customer_id,sender_id,recipient_id,kind,subject,body) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,customer.id,actor.id,data.kind==='direct'?data.recipientId:null,data.kind,subject,body])
    for(const recipient of ids.rows)await client.query(`INSERT INTO communication_recipients(message_id,customer_id,user_id) VALUES($1,$2,$3)`,[id,customer.id,recipient.id])
    await client.query('COMMIT')
    return {id,recipientCount:ids.rows.length}
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
})

export const markCommunicationRead=createServerFn({method:'POST'}).inputValidator((data:{messageId:string})=>data).handler(async({data})=>{
 const actor=await requireActiveUser();const customer=await getCustomerContext()
 await getDb().query(`UPDATE communication_recipients SET read_at=COALESCE(read_at,now()) WHERE message_id=$1 AND customer_id=$2 AND user_id=$3`,[data.messageId,customer.id,actor.id])
 return {ok:true}
})


export const listWorkflowNotifications = createServerFn({method:'GET'}).handler(async()=>{
 const actor=await requireActiveUser();const customer=await getCustomerContext()
 const result=await getDb().query<{id:string;title:string;body:string;createdAt:string;readAt:string|null;caseFileId:string|null;reportId:string|null;targetPath:string|null}>(
 `SELECT id,title,body,created_at::text AS "createdAt",read_at::text AS "readAt",case_file_id AS "caseFileId",report_id AS "reportId",target_path AS "targetPath"
 FROM workflow_notifications WHERE customer_id=$1 AND recipient_id=$2 ORDER BY created_at DESC LIMIT 200`,[customer.id,actor.id])
 return result.rows
})
export const markWorkflowNotificationRead=createServerFn({method:'POST'}).inputValidator((data:{id:string})=>data).handler(async({data})=>{
 const actor=await requireActiveUser();const customer=await getCustomerContext()
 await getDb().query(`UPDATE workflow_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND customer_id=$2 AND recipient_id=$3`,[data.id,customer.id,actor.id])
 return {ok:true}
})

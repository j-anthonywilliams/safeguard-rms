-- Customer-scoped, idempotent workflow notifications. Run on customer Postgres only.
BEGIN;
CREATE TABLE IF NOT EXISTS workflow_notifications (
 id text PRIMARY KEY, customer_id text NOT NULL REFERENCES customer_settings(id),
 recipient_id text NOT NULL REFERENCES users(id), event_key text NOT NULL,
 event_type text NOT NULL, title text NOT NULL, body text NOT NULL DEFAULT '',
 case_file_id text, report_id text, target_path text,
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE(customer_id,recipient_id,event_key)
);
CREATE INDEX IF NOT EXISTS workflow_notifications_inbox ON workflow_notifications(customer_id,recipient_id,created_at DESC);
CREATE OR REPLACE FUNCTION safeguard_workflow_notice() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE recipient text; label text; details text; event text; target text; caseid text; reportid text; recipient_row record;
BEGIN
 IF TG_TABLE_NAME='personnel_training_assignments' THEN
   IF TG_OP<>'INSERT' THEN RETURN NEW; END IF;
   recipient:=NEW.user_id; label:='New training assigned'; event:='training_assigned';
   SELECT title INTO details FROM personnel_training_classes WHERE id=NEW.class_id AND customer_id=NEW.customer_id;
   target:='/app/training';
 ELSIF TG_TABLE_NAME='personnel_time_off_requests' THEN
   IF TG_OP<>'UPDATE' OR NEW.status<>'rejected' OR OLD.status='rejected' THEN RETURN NEW; END IF;
   recipient:=NEW.user_id; label:='Leave request denied'; event:='leave_denied';
   details:=COALESCE(NEW.review_note,''); target:='/app/onboarding';
 ELSIF TG_TABLE_NAME='personnel_administrative_reports' THEN
   IF TG_OP<>'UPDATE' OR NEW.status<>'rejected' OR OLD.status='rejected' THEN RETURN NEW; END IF;
   recipient:=NEW.author_id; label:='Administrative report rejected'; event:='administrative_report_rejected';
   details:=COALESCE(NEW.review_note,''); target:='/app/administrative-reports';
 ELSIF TG_TABLE_NAME='incidents' THEN
   IF TG_OP<>'UPDATE' OR NEW.approval_status<>'Rejected' OR OLD.approval_status='Rejected' THEN RETURN NEW; END IF;
   recipient:=NEW.user_id; label:='Incident report rejected'; event:='incident_rejected';
   details:=COALESCE(NEW.report_number,''); target:='/app/incidents?reportId='||NEW.id;
 ELSIF TG_TABLE_NAME='equipment_transactions' THEN
   IF TG_OP<>'INSERT' OR NEW.employee_id IS NULL THEN RETURN NEW; END IF;
   recipient:=NEW.employee_id; event:='equipment_'||NEW.action;
   label:=CASE WHEN NEW.action='issue' THEN 'Equipment issued — receipt' ELSE 'Equipment returned — receipt' END;
   details:='Asset: '||NEW.equipment_id||'; Processed by: '||NEW.actor_id||'; Condition: '||COALESCE(NEW.condition_note,'');
   target:='/app/equipment';
 ELSE RETURN NEW;
 END IF;
 IF recipient IS NOT NULL THEN
   INSERT INTO workflow_notifications(id,customer_id,recipient_id,event_key,event_type,title,body,target_path)
   SELECT gen_random_uuid()::text,NEW.customer_id,recipient,TG_TABLE_NAME||':'||NEW.id||':'||event,event,label,COALESCE(details,''),target
   WHERE EXISTS (SELECT 1 FROM users u WHERE u.id=recipient AND COALESCE(u.is_archived,0)=0)
   ON CONFLICT(customer_id,recipient_id,event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notify_training_assigned ON personnel_training_assignments;
CREATE TRIGGER notify_training_assigned AFTER INSERT ON personnel_training_assignments FOR EACH ROW EXECUTE FUNCTION safeguard_workflow_notice();
DROP TRIGGER IF EXISTS notify_leave_denied ON personnel_time_off_requests;
CREATE TRIGGER notify_leave_denied AFTER UPDATE OF status ON personnel_time_off_requests FOR EACH ROW EXECUTE FUNCTION safeguard_workflow_notice();
DROP TRIGGER IF EXISTS notify_admin_report_rejected ON personnel_administrative_reports;
CREATE TRIGGER notify_admin_report_rejected AFTER UPDATE OF status ON personnel_administrative_reports FOR EACH ROW EXECUTE FUNCTION safeguard_workflow_notice();
DROP TRIGGER IF EXISTS notify_incident_rejected ON incidents;
CREATE TRIGGER notify_incident_rejected AFTER UPDATE OF approval_status ON incidents FOR EACH ROW EXECUTE FUNCTION safeguard_workflow_notice();
DROP TRIGGER IF EXISTS notify_equipment_receipt ON equipment_transactions;
CREATE TRIGGER notify_equipment_receipt AFTER INSERT ON equipment_transactions FOR EACH ROW EXECUTE FUNCTION safeguard_workflow_notice();
COMMIT;

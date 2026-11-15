-- Apply to each customer PostgreSQL database after taking a backup.
BEGIN;
CREATE TABLE IF NOT EXISTS incident_involved_persons (
 id UUID PRIMARY KEY,
 incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
 customer_id UUID NOT NULL,
 name TEXT NOT NULL,
 date_of_birth DATE,
 phone TEXT,
 email TEXT,
 address TEXT,
 relationships TEXT[] NOT NULL DEFAULT ARRAY['Other Party']::TEXT[],
 comments TEXT NOT NULL DEFAULT '',
 sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT involved_persons_name_not_blank CHECK (length(trim(name)) > 0),
 CONSTRAINT involved_persons_relationships_not_empty CHECK (cardinality(relationships) > 0),
 CONSTRAINT involved_persons_relationships_valid CHECK (relationships <@ ARRAY['Victim','Witness','Suspect','Reporting Party','Other Party']::TEXT[])
);
CREATE TABLE IF NOT EXISTS incident_involved_person_audit (
 id UUID PRIMARY KEY,
 incident_id UUID NOT NULL,
 customer_id UUID NOT NULL,
 actor_id UUID NOT NULL,
 previous_records JSONB NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS incident_involved_person_audit_incident_idx ON incident_involved_person_audit(customer_id,incident_id,occurred_at);
CREATE INDEX IF NOT EXISTS incident_involved_persons_incident_idx ON incident_involved_persons(customer_id,incident_id,sort_order);
-- Preserve legacy single-subject records; the original columns remain for compatibility.
INSERT INTO incident_involved_persons(id,incident_id,customer_id,name,date_of_birth,phone,relationships,sort_order)
SELECT gen_random_uuid(),i.id,i.customer_id,i.subject_name,
 CASE WHEN i.subject_dob::text ~ '^\d{4}-\d{2}-\d{2}$' AND i.subject_dob::date <= CURRENT_DATE THEN i.subject_dob::date ELSE NULL END,
 i.subject_phone,ARRAY['Other Party']::TEXT[],0
FROM incidents i WHERE NULLIF(trim(i.subject_name),'') IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM incident_involved_persons p WHERE p.incident_id=i.id AND p.customer_id=i.customer_id);
COMMIT;

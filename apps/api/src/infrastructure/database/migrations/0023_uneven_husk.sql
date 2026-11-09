CREATE TABLE IF NOT EXISTS "product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"household_id" uuid,
	"subject_id" uuid,
	"subject_kind" varchar(40),
	"activity_date" date,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_event_occurred_idx" ON "product_events" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_actor_occurred_idx" ON "product_events" USING btree ("actor_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_events_household_occurred_idx" ON "product_events" USING btree ("household_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_events_daily_activity_unique_idx" ON "product_events" USING btree ("actor_user_id","activity_date") WHERE "product_events"."event_name" = 'user.active';
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "subject_id", "subject_kind", "metadata")
SELECT 'user.registered', "created_at", "id", "id", 'user', '{"backfilled":true}'::jsonb FROM "users";
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind", "metadata")
SELECT 'household.created', "created_at", "owner_id", "id", "id", 'household', '{"backfilled":true}'::jsonb FROM "households";
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind", "metadata")
SELECT 'household.joined', "joined_at", "user_id", "household_id", "user_id", 'membership', '{"backfilled":true}'::jsonb FROM "household_members";
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind", "metadata")
SELECT 'invitation.created', "created_at", "created_by_id", "household_id", "id", 'invitation', '{"backfilled":true}'::jsonb FROM "household_invitations";
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind", "metadata")
SELECT 'invitation.accepted', "accepted_at", "accepted_by_id", "household_id", "id", 'invitation', '{"backfilled":true}'::jsonb FROM "household_invitations" WHERE "accepted_at" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind", "metadata")
SELECT 'transaction.created', i."created_at", i."user_id", i."household_id", i."id", 'income',
  '{"backfilled":true}'::jsonb
FROM "incomes" i;
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind", "metadata")
SELECT 'transaction.created', e."created_at", e."user_id", e."household_id", e."id", 'expense',
  '{"backfilled":true}'::jsonb
FROM "expenses" e;
--> statement-breakpoint
INSERT INTO "product_events" ("event_name", "metadata") VALUES ('analytics.collection_started', '{}');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "record_simple_product_event"() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "subject_id", "subject_kind")
    VALUES ('user.registered', NEW."created_at", NEW."id", NEW."id", 'user');
  ELSIF TG_TABLE_NAME = 'households' THEN
    INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind")
    VALUES ('household.created', NEW."created_at", NEW."owner_id", NEW."id", NEW."id", 'household');
  ELSIF TG_TABLE_NAME = 'household_members' THEN
    INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind")
    VALUES ('household.joined', NEW."joined_at", NEW."user_id", NEW."household_id", NEW."user_id", 'membership');
  ELSIF TG_TABLE_NAME = 'household_invitations' AND TG_OP = 'INSERT' THEN
    INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind")
    VALUES ('invitation.created', NEW."created_at", NEW."created_by_id", NEW."household_id", NEW."id", 'invitation');
  ELSIF TG_TABLE_NAME = 'household_invitations' AND OLD."accepted_at" IS NULL AND NEW."accepted_at" IS NOT NULL THEN
    INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind")
    VALUES ('invitation.accepted', NEW."accepted_at", NEW."accepted_by_id", NEW."household_id", NEW."id", 'invitation');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "users_product_event" AFTER INSERT ON "users" FOR EACH ROW EXECUTE FUNCTION "record_simple_product_event"();
--> statement-breakpoint
CREATE TRIGGER "households_product_event" AFTER INSERT ON "households" FOR EACH ROW EXECUTE FUNCTION "record_simple_product_event"();
--> statement-breakpoint
CREATE TRIGGER "household_members_product_event" AFTER INSERT ON "household_members" FOR EACH ROW EXECUTE FUNCTION "record_simple_product_event"();
--> statement-breakpoint
CREATE TRIGGER "invitations_created_product_event" AFTER INSERT ON "household_invitations" FOR EACH ROW EXECUTE FUNCTION "record_simple_product_event"();
--> statement-breakpoint
CREATE TRIGGER "invitations_accepted_product_event" AFTER UPDATE OF "accepted_at" ON "household_invitations" FOR EACH ROW EXECUTE FUNCTION "record_simple_product_event"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "record_transaction_product_event"() RETURNS trigger AS $$
DECLARE
  event_name text;
  kind text;
  event_actor uuid;
  event_household uuid;
  event_subject uuid;
BEGIN
  event_name := CASE TG_OP WHEN 'INSERT' THEN 'transaction.created' WHEN 'UPDATE' THEN 'transaction.updated' ELSE 'transaction.deleted' END;
  kind := CASE WHEN TG_TABLE_NAME = 'incomes' THEN 'income' ELSE 'expense' END;
  IF TG_OP = 'DELETE' THEN
    event_actor := OLD."user_id"; event_household := OLD."household_id"; event_subject := OLD."id";
  ELSE
    event_actor := NEW."user_id"; event_household := NEW."household_id"; event_subject := NEW."id";
  END IF;
  INSERT INTO "product_events" ("event_name", "occurred_at", "actor_user_id", "household_id", "subject_id", "subject_kind")
  VALUES (event_name, now(), event_actor, event_household, event_subject, kind);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "incomes_product_event" AFTER INSERT OR UPDATE OR DELETE ON "incomes" FOR EACH ROW EXECUTE FUNCTION "record_transaction_product_event"();
--> statement-breakpoint
CREATE TRIGGER "expenses_product_event" AFTER INSERT OR UPDATE OR DELETE ON "expenses" FOR EACH ROW EXECUTE FUNCTION "record_transaction_product_event"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_product_events"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'product_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "product_events_append_only" BEFORE UPDATE OR DELETE ON "product_events" FOR EACH ROW EXECUTE FUNCTION "protect_product_events"();

CREATE TABLE IF NOT EXISTS "recurrence_exclusions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"recurrence_id" uuid NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurrence_exclusions" ADD CONSTRAINT "recurrence_exclusions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recurrence_exclusions_recurrence_date_unique_idx" ON "recurrence_exclusions" USING btree ("recurrence_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurrence_exclusions_household_id_idx" ON "recurrence_exclusions" USING btree ("household_id");
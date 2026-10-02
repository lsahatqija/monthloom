ALTER TABLE "households" ADD COLUMN "name" varchar(160);--> statement-breakpoint
UPDATE "households"
SET "name" = COALESCE(
  (
    SELECT "users"."display_name" || '''s Household'
    FROM "household_members"
    INNER JOIN "users" ON "users"."id" = "household_members"."user_id"
    WHERE "household_members"."household_id" = "households"."id"
    ORDER BY "household_members"."joined_at", "users"."created_at", "users"."id"
    LIMIT 1
  ),
  'Household'
);--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "name" SET NOT NULL;

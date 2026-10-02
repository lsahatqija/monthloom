ALTER TABLE "household_members" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
WITH "ranked_memberships" AS (
	SELECT
		"household_id",
		"user_id",
		ROW_NUMBER() OVER (
			PARTITION BY "user_id"
			ORDER BY "joined_at", "household_id"
		) AS "membership_rank"
	FROM "household_members"
)
UPDATE "household_members"
SET "is_primary" = true
FROM "ranked_memberships"
WHERE "household_members"."household_id" = "ranked_memberships"."household_id"
	AND "household_members"."user_id" = "ranked_memberships"."user_id"
	AND "ranked_memberships"."membership_rank" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "household_members_primary_user_unique_idx" ON "household_members" USING btree ("user_id") WHERE "household_members"."is_primary";

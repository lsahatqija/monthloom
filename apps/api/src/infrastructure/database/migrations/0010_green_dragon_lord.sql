ALTER TABLE "expenses" DROP CONSTRAINT "expenses_household_member_fk";
--> statement-breakpoint
ALTER TABLE "incomes" DROP CONSTRAINT "incomes_household_member_fk";
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "icon" "financial_icon" DEFAULT 'house' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "color" varchar(7) DEFAULT '#35675b' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "households"
SET "owner_id" = (
  SELECT "user_id"
  FROM "household_members"
  WHERE "household_members"."household_id" = "households"."id"
  ORDER BY "joined_at", "user_id"
  LIMIT 1
);--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "households" ADD CONSTRAINT "households_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incomes" ADD CONSTRAINT "incomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "households_owner_id_idx" ON "households" USING btree ("owner_id");
--> statement-breakpoint
ALTER TABLE "households" ADD CONSTRAINT "households_color_format_check" CHECK ("households"."color" ~ '^#[0-9A-Fa-f]{6}$');

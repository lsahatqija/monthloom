DO $$ BEGIN
 CREATE TYPE "public"."expense_type" AS ENUM('housing', 'groceries', 'dining', 'transport', 'utilities', 'healthcare', 'insurance', 'childcare', 'education', 'entertainment', 'shopping', 'travel', 'subscriptions', 'taxes', 'debt', 'savings', 'gifts', 'pets', 'personal-care', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."financial_icon" AS ENUM('banknote', 'briefcase', 'building', 'coins', 'landmark', 'piggy-bank', 'trending-up', 'wallet', 'gift', 'house', 'store', 'shopping-cart', 'shopping-basket', 'shopping-bag', 'apple', 'utensils', 'coffee', 'pizza', 'car', 'bus', 'fuel', 'plane', 'plug', 'droplet', 'wifi', 'smartphone', 'heart-pulse', 'shield', 'graduation-cap', 'book-open', 'gamepad', 'music', 'film', 'shirt', 'dumbbell', 'baby', 'paw-print', 'scissors', 'wrench', 'receipt', 'credit-card', 'circle-ellipsis');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "expense_type" NOT NULL,
	"icon" "financial_icon" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"date" date NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_positive_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_members" (
	"household_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_members_household_id_user_id_pk" PRIMARY KEY("household_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency" char(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_currency_format_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"date" date NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incomes_positive_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"name_key" varchar(120) NOT NULL,
	"icon" "financial_icon" NOT NULL,
	"color" varchar(7) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_color_format_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sources_household_id_id_unique_idx" ON "sources" USING btree ("household_id","id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_member_fk" FOREIGN KEY ("household_id","user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_household_source_fk" FOREIGN KEY ("household_id","source_id") REFERENCES "public"."sources"("household_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incomes" ADD CONSTRAINT "incomes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incomes" ADD CONSTRAINT "incomes_household_member_fk" FOREIGN KEY ("household_id","user_id") REFERENCES "public"."household_members"("household_id","user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incomes" ADD CONSTRAINT "incomes_household_source_fk" FOREIGN KEY ("household_id","source_id") REFERENCES "public"."sources"("household_id","id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sources" ADD CONSTRAINT "sources_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_household_date_idx" ON "expenses" USING btree ("household_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_household_type_idx" ON "expenses" USING btree ("household_id","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_user_id_idx" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_source_id_idx" ON "expenses" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "household_members_user_id_idx" ON "household_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incomes_household_date_idx" ON "incomes" USING btree ("household_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incomes_user_id_idx" ON "incomes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incomes_source_id_idx" ON "incomes" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sources_household_id_idx" ON "sources" USING btree ("household_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sources_household_name_key_unique_idx" ON "sources" USING btree ("household_id","name_key");

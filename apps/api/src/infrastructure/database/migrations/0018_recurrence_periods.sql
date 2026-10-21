CREATE TYPE "public"."recurrence_unit" AS ENUM('day', 'week', 'month', 'year');--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "recurrence_interval" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "recurrence_unit" "recurrence_unit" DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_interval" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "recurrence_unit" "recurrence_unit" DEFAULT 'month' NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_recurrence_interval_check" CHECK ("incomes"."recurrence_interval" BETWEEN 1 AND 99);--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurrence_interval_check" CHECK ("expenses"."recurrence_interval" BETWEEN 1 AND 99);

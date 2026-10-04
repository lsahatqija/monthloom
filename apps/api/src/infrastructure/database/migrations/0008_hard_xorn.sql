ALTER TABLE "expenses" ADD COLUMN "recurrence_id" uuid;--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "recurrence_id" uuid;--> statement-breakpoint
UPDATE "expenses" SET "recurrence_id" = "id" WHERE "recurring";--> statement-breakpoint
UPDATE "incomes" SET "recurrence_id" = "id" WHERE "recurring";

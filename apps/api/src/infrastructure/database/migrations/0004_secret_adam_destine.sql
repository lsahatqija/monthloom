ALTER TABLE "expenses" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "icon" "financial_icon";--> statement-breakpoint
ALTER TABLE "incomes" ADD COLUMN "color" varchar(7);--> statement-breakpoint
UPDATE "expenses"
SET "color" = "sources"."color"
FROM "sources"
WHERE "expenses"."source_id" = "sources"."id";--> statement-breakpoint
UPDATE "incomes"
SET
	"icon" = "sources"."icon",
	"color" = "sources"."color"
FROM "sources"
WHERE "incomes"."source_id" = "sources"."id";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ALTER COLUMN "icon" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "incomes" ALTER COLUMN "color" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_color_format_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_color_format_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "icon";--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN IF EXISTS "color";

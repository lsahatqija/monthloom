ALTER TABLE "sources" ADD COLUMN "aliases" varchar(120)[] DEFAULT ARRAY[]::varchar[] NOT NULL;
--> statement-breakpoint
UPDATE "sources" SET "aliases" = ARRAY["display_name"];
--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_aliases_include_display_name_check" CHECK ("display_name" = ANY("aliases"));

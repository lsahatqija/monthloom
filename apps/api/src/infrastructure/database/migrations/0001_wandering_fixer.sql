DO $$ BEGIN
 CREATE TYPE "public"."desired_color" AS ENUM('indigo', 'blue', 'teal', 'green', 'amber', 'rose');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."profile_image" AS ENUM('moon', 'sun', 'stars', 'cloud');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image" "profile_image" DEFAULT 'moon' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "desired_color" "desired_color" DEFAULT 'indigo' NOT NULL;
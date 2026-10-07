DO $$ BEGIN
 CREATE TYPE "public"."household_icon" AS ENUM('small-house', 'family-house', 'large-house', 'beach-house', 'mountain-cabin', 'cottage', 'farmhouse', 'townhouse', 'short-apartments', 'tall-apartments', 'office-building', 'rv', 'shack', 'villa', 'houseboat', 'shared-house');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "icon" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "icon" SET DATA TYPE household_icon
USING (
  CASE "icon"::text
    WHEN 'building' THEN 'tall-apartments'
    WHEN 'briefcase' THEN 'office-building'
    WHEN 'bus' THEN 'rv'
    WHEN 'store' THEN 'short-apartments'
    ELSE 'small-house'
  END
)::household_icon;--> statement-breakpoint
ALTER TABLE "households" ALTER COLUMN "icon" SET DEFAULT 'small-house';

ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'slate';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'red';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'orange';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'yellow';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'lime';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'emerald';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'cyan';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'sky';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'violet';--> statement-breakpoint
ALTER TYPE "desired_color" ADD VALUE IF NOT EXISTS 'purple';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "profile_image" DROP DEFAULT;--> statement-breakpoint
CREATE TYPE "profile_image_new" AS ENUM(
	'diamond-kilim',
	'chevron-weave',
	'lattice-loom',
	'stepped-medallion',
	'hooked-diamond',
	'basket-weave',
	'wave-stripe',
	'star-rosette',
	'hourglass-thread',
	'mosaic-grid',
	'braided-border',
	'concentric-lozenge'
);--> statement-breakpoint
ALTER TABLE "users"
	ALTER COLUMN "profile_image" TYPE "profile_image_new"
	USING (
		CASE "profile_image"::text
			WHEN 'moon' THEN 'diamond-kilim'
			WHEN 'sun' THEN 'chevron-weave'
			WHEN 'stars' THEN 'lattice-loom'
			WHEN 'cloud' THEN 'stepped-medallion'
		END
	)::"profile_image_new";--> statement-breakpoint
DROP TYPE "profile_image";--> statement-breakpoint
ALTER TYPE "profile_image_new" RENAME TO "profile_image";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "profile_image" SET DEFAULT 'diamond-kilim';

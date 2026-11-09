ALTER TABLE "users" ADD COLUMN "last_active_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_last_active_at_idx" ON "users" USING btree ("last_active_at");
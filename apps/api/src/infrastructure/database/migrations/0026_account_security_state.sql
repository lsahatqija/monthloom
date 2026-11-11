ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp with time zone;
CREATE INDEX "users_locked_until_idx" ON "users" USING btree ("locked_until");
CREATE INDEX "users_suspended_at_idx" ON "users" USING btree ("suspended_at");

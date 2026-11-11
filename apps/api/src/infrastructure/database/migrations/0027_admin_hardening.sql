ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;

ALTER TABLE "request_hourly_rollups"
  ADD COLUMN "duration_le_10_ms" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "duration_le_50_ms" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "duration_le_100_ms" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "duration_le_250_ms" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "duration_le_500_ms" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "duration_le_1000_ms" integer DEFAULT 0 NOT NULL;

CREATE TABLE "operational_status" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "status" varchar(20) NOT NULL,
  "last_attempt_at" timestamp with time zone NOT NULL,
  "last_success_at" timestamp with time zone,
  "duration_ms" integer,
  "detail" varchar(160) NOT NULL
);

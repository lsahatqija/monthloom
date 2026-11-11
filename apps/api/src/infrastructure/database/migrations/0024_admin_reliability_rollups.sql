CREATE TABLE "request_hourly_rollups" (
  "hour" timestamp with time zone NOT NULL,
  "method" varchar(10) NOT NULL,
  "route" varchar(160) NOT NULL,
  "status_class" integer NOT NULL,
  "application_version" varchar(40) NOT NULL,
  "client_version" varchar(40) DEFAULT 'unknown' NOT NULL,
  "request_count" integer DEFAULT 0 NOT NULL,
  "duration_total_ms" bigint DEFAULT 0 NOT NULL,
  "duration_max_ms" integer DEFAULT 0 NOT NULL,
  "database_total_ms" bigint DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX "request_hourly_rollups_identity_idx" ON "request_hourly_rollups" ("hour", "method", "route", "status_class", "application_version", "client_version");
CREATE INDEX "request_hourly_rollups_range_idx" ON "request_hourly_rollups" ("hour");

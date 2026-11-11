CREATE TABLE "application_deployments" (
  "version" varchar(40) NOT NULL,
  "deployed_at" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX "application_deployments_identity_idx" ON "application_deployments" ("version", "deployed_at");

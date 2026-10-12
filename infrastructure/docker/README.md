# infrastructure/docker

Application Dockerfiles live next to each app (`apps/api/Dockerfile`, `apps/web/Dockerfile`) so
build context and layer caching stay close to the code they package. This directory is reserved
for any additional local infrastructure assets (e.g. database init scripts) that don't belong to a
single app. See `compose.yml` at the repository root for the full local infrastructure definition.

Production assets for the single-server Hetzner deployment live in
[`../production`](../production/), with the complete runbook in
[`docs/deployment-hetzner.md`](../../docs/deployment-hetzner.md).

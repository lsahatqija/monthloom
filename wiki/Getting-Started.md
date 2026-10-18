# Getting started

## Prerequisites

- Node.js 20.11 or newer
- pnpm 9 or newer
- Docker with Docker Compose

## Start the complete local stack

```sh
cp .env.example .env
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm db:seed
```

Change `SESSION_SECRET` in `.env` before starting. Seeding is optional and intended only for local
development. Open the application at <http://localhost:3000>; the API is available at
<http://localhost:4000> and development Swagger UI at <http://localhost:4000/api/docs>.

Stop the stack with:

```sh
pnpm docker:down
```

## Application-focused development

Run PostgreSQL in Docker, then launch the API and web app in watch mode:

```sh
docker compose up -d postgres
pnpm db:migrate
pnpm dev
```

See [Runtime configuration](Runtime-Configuration) for environment settings and [Testing](Testing)
for the test commands and isolated test database.

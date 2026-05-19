# TaskFlow Pro — Enterprise Task Collaboration Platform

A full-stack enterprise task management and collaboration platform supporting multi-team, multi-project management with Kanban boards, Gantt charts, real-time collaboration, notifications, and webhook integrations.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────┐
│   Frontend   │────▶│   Backend   │────▶│  PostgreSQL  │     │  Redis  │
│  React 18    │     │  Fastify 4  │────▶│     16       │     │    7    │
│  Vite 5      │     │  Prisma 5   │     └──────────────┘     └─────────┘
│  Tailwind 3  │◀────│  Socket.IO  │
└─────────────┘     └─────────────┘
     :5173               :3000              :5432               :6379
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Node.js 20 + Fastify 4 + TypeScript (strict) |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 |
| UI Library | Radix UI |
| Real-time | Socket.IO 4 |
| Testing | Vitest 1 + Supertest + Playwright |
| Deployment | Docker + Docker Compose |

## Quick Start

### Docker Compose (recommended)

```bash
docker compose up
```

All four services (backend, frontend, PostgreSQL, Redis) will start and become healthy within 60 seconds.

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- Swagger UI: http://localhost:3000/api-docs
- Health Check: http://localhost:3000/api/v1/health

### Local Development

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

## Environment Variables

```bash
DATABASE_URL=postgresql://taskflow:taskflow_pass@localhost:5432/taskflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-refresh-secret>
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=<ethereal-user>
SMTP_PASS=<ethereal-pass>
```

## Testing

```bash
# Backend unit tests
cd backend
npm test

# Frontend E2E tests
cd frontend
npx playwright test
```

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| M1 Auth & Team | Implemented | Registration, login, team CRUD, member management |
| M2 Project | Planned | Project CRUD, members, archive |
| M3 Task Core | Planned | Tasks, subtasks, dependencies, attachments, comments |
| M4 View & Collaboration | Planned | Kanban, Gantt, list view, real-time |
| M5 Notifications | Planned | In-app, email, webhooks, dashboard |
| M6 DevOps & Quality | Planned | Docker, testing, docs |

## API Documentation

Visit `/api-docs` when the server is running for the full OpenAPI/Swagger documentation.

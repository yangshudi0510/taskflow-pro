# TaskFlow Pro — Implementation Plan

## Architecture Overview

```
taskflow-pro/
├── backend/           # Fastify 4.x + Prisma 5.x + TypeScript
│   ├── prisma/        # Schema & migrations
│   ├── src/
│   │   ├── app.ts     # Fastify instance export
│   │   ├── server.ts  # Entry point (port 3000)
│   │   ├── plugins/   # Auth, RBAC, WebSocket, Swagger
│   │   └── modules/   # Feature modules
│   │       ├── auth/
│   │       ├── teams/
│   │       ├── projects/
│   │       ├── tasks/
│   │       ├── comments/
│   │       ├── attachments/
│   │       ├── activities/
│   │       ├── notifications/
│   │       ├── webhooks/
│   │       ├── dashboard/
│   │       ├── search/
│   │       ├── audit/
│   │       ├── tags/
│   │       └── templates/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── frontend/          # React 18 + Vite 5.x + Tailwind + Radix UI
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── pages/     # 12 pages
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── stores/    # Zustand state management
│   │   └── lib/
│   │       └── api.ts # API client base /api/v1
│   ├── tests/e2e/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── Plans.md
└── README.md
```

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Validation | Zod | Type-safe, excellent TS integration |
| State Management | Zustand + React Query | Zustand for UI state, React Query for server state |
| Drag & Drop | @dnd-kit | Modern, accessible, performant |
| Routing | React Router v6 | Widely adopted, stable |
| Forms | React Hook Form + Zod | Best DX with Zod validation |
| Gantt Chart | Custom SVG | Full control over rendering |
| Email | Nodemailer + Ethereal | PRD specified |
| API Client | Axios | Interceptor support for auth |

## Module Implementation Order & Parallelization

### Phase 1: Foundation (M1 - this session)
**PR-1: M1 Auth & Team + Project Infrastructure**
- Project scaffolding (monorepo, Docker, CI)
- Prisma schema (ALL tables)
- Auth module (register, login, refresh, profile, settings)
- Team module (CRUD, members, invitations)
- RBAC middleware (20 permissions × 4 roles)
- Health endpoint, Swagger setup
- Frontend: Login, Register, Settings, Team pages
- Unit tests for auth & team services

### Phase 2: Parallel Development (Child Devin Sessions)

**PR-2: M2 Project Management** (Child Session A)
- Project CRUD, archive, delete (soft + hard)
- Project members management
- Project status workflow
- Frontend: ProjectPage, ProjectDetailPage
- Unit tests

**PR-3: M3 Task Core** (Child Session B)
- Task CRUD, subtasks, dependencies
- Batch operations, attachments, comments
- Tags, templates
- CSV import/export
- Frontend: TaskDetailPage, MyTasksPage
- Unit tests

**PR-4: M4 View & Collaboration** (Child Session C)
- Board view with drag-and-drop
- List view with sort/filter
- Gantt chart
- Activity stream
- Online presence (WebSocket)
- Advanced search
- Frontend: BoardPage, GanttPage
- Unit tests

**PR-5: M5 Notification & Integration** (Child Session D)
- In-app notifications
- Email notifications (Ethereal)
- WebSocket real-time push
- Webhook configuration & delivery
- Dashboard statistics
- Audit log
- Frontend: NotificationsPage, DashboardPage
- Unit tests

**PR-6: M6 DevOps & Quality** (Child Session E or main session)
- OpenAPI documentation completion
- Docker optimization
- Test suite completion (coverage >= 70%)
- E2E tests (Playwright)
- README, architecture docs, ADRs

## Database Schema (14+ tables)

Core tables (immutable names/fields per tech constraints):
1. User
2. Team
3. TeamMember
4. Project
5. ProjectMember
6. Task
7. TaskDependency
8. Comment
9. Mention
10. Attachment
11. Activity
12. Notification
13. Webhook

Additional tables:
14. Tag
15. TaskTag
16. Template
17. UserSetting
18. AuditLog
19. TrashItem
20. WebhookDelivery
21. Invitation
22. Session (for active session tracking)
23. PasswordHistory

## API Endpoints Summary

Total: 60+ endpoints across 14 modules
- Auth: 8 endpoints
- Teams: 10 endpoints
- Projects: 12 endpoints
- Tasks: 10 endpoints
- Subtasks: 2 endpoints
- Dependencies: 3 endpoints
- Comments: 4 endpoints
- Attachments: 4 endpoints
- Activities: 3 endpoints
- Notifications: 4 endpoints
- Webhooks: 7 endpoints
- Tags: 4 endpoints
- Templates: 4 endpoints
- Dashboard: 3 endpoints
- Audit: 2 endpoints
- Search: 1 endpoint
- Health: 1 endpoint

## RBAC Matrix (20 permissions × 4 roles)

Implemented as middleware with fine-grained permission checks.
See 02-tech-constraints.md Section 5 for the full matrix.

## Acceptance Criteria Tracking

- [ ] /health returns 200
- [ ] docker-compose up healthy in 60s
- [ ] Unit test coverage >= 70%
- [ ] All APIs documented in OpenAPI
- [ ] 24/24 RBAC auth tests pass
- [ ] 40 E2E scenarios
- [ ] 5 performance benchmarks pass

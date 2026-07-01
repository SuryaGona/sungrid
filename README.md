# SunGrid

SunGrid is a multi-tenant project management SaaS inspired by modern agile workflow platforms. Teams collaborate within isolated workspaces containing projects, issues, boards, sprints, and activity history while maintaining strict workspace-level access boundaries.

## Features

### Workspace Management

* Multi-tenant workspace architecture with isolated project and member data
* Workspace membership managed through dedicated access records
* Activity tracking across projects and team actions

### Authentication & Authorization

* Authentication powered by Clerk
* Workspace-scoped authorization enforced through access records
* Protected server-side routes and actions using Next.js

### Project & Issue Tracking

* Project organization within workspaces
* Issue management with status, priority, type, story points, and due dates
* Archive and restore workflows for projects and issues
* Activity logging for project changes

### Agile Workflow Tools

* Kanban-style project boards
* Sprint planning and tracking
* Sprint completion reporting and analytics

### Demo Environment

* One-click guest access for product evaluation
* Automatically seeded demo workspaces, projects, and issues
* Demo data isolated from production user environments

## Tech Stack

| Category       | Technology           |
| -------------- | -------------------- |
| Framework      | Next.js (App Router) |
| Language       | TypeScript           |
| Database       | PostgreSQL (Neon)    |
| ORM            | Prisma               |
| Authentication | Clerk                |
| Styling        | Tailwind CSS         |
| Deployment     | Vercel               |

## Architecture

SunGrid uses a relational multi-tenant architecture where workspace membership is represented through access records rather than relying solely on user authentication.

```txt
User → Access Record → Workspace → Project → Issue
```

This model ensures that every project, issue, sprint, and activity record is scoped to a workspace through explicit relationships, simplifying authorization checks and reducing the risk of cross-workspace data exposure.

## Engineering Highlights

### Multi-Tenant Access Model

Designed a relational access layer that separates authentication from authorization. Users authenticate globally, while workspace permissions are enforced through access records tied to individual workspaces.

### Server-Side Authorization

Implemented authorization checks within protected server routes and actions to ensure workspace resources can only be accessed by authorized members.

### Relational Data Design

Built a PostgreSQL schema connecting users, workspaces, access records, projects, issues, sprints, and activity logs while preserving referential integrity across the application.

### Archive & Recovery Workflows

Implemented soft-delete functionality for projects and issues, allowing data recovery without permanently removing records from the system.

### Production Deployment

Deployed on Vercel with Prisma and Neon, including connection management optimized for a serverless environment.


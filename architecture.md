# Only Tasks Architecture

## Goal

Build a single Next.js application focused only on task management.

This app should:

- combine frontend and backend in one codebase
- preserve the strongest parts of the current task system
- remove unrelated product surface area
- stay simple to deploy and evolve

The current `atum` + `atum-fe` split should not be copied as-is. The right move is to extract the task engine into a modular monolith inside one Next.js app.

## Current Migration Decisions

These decisions supersede the earlier PostgreSQL-first recommendation in this document:

- run one Next.js app on the existing EC2 setup
- keep SQLite as the production database for this focused app until scale proves otherwise
- keep auth, task data, users, and subscription state in the same SQLite database
- keep legacy subscription rows, but mark old PayPal/LemonSqueezy rows for Paddle migration review
- do not port the old multi-product billing surface
- when Paddle is added, treat Paddle as the source of truth for checkout, receipts, payment method handling, and subscription webhooks
- keep local invoice/payment rows only if we need an internal ledger for support or entitlement debugging

## Billing And Invoice Save Flow

The old `atum` backend saved invoices only after provider-side payment confirmation.

Old flow:

1. Checkout start created a local `subscriptions` row in `pending` state.
2. Checkout start also created a local `payments` row with `status = pending` and `invoiceId = null`.
3. Provider confirmation was handled by `processPayPalSubscription`, PayPal webhook processing, or `processLemonSqueezySubscription`.
4. The confirmed payment row was marked `completed`.
5. `createSubscriptionInvoice` created one `invoices` row with `status = paid`.
6. `createSubscriptionInvoice` also created one `invoiceItems` row for the plan line item.
7. The payment row was patched with the new `invoiceId`.
8. Invoice email queuing existed in code, but was commented out.

Important implementation detail: the old invoice write was not transactional. It inserted the invoice first, then inserted invoice items, then separately updated the payment with `invoiceId`. For this app, if we add internal invoice rows, that should be one SQLite transaction so payment, invoice, and invoice item cannot drift.

Paddle direction:

- Paddle should own receipts and customer-facing invoice documents because it is the merchant of record.
- Our DB should store subscription state, Paddle customer id, Paddle subscription id, Paddle price id, status, period dates, and raw webhook event ids.
- Optional internal invoice rows should be derived from verified Paddle transaction or subscription events, not from client checkout completion alone.
- Webhook handling must be idempotent by Paddle event id and must ignore stale subscription updates.
- A client "checkout complete" call is useful as a fast confirmation path, but the Paddle webhook remains the durable source of truth.

Implemented Paddle shape:

- `/pricing` offers `pro_monthly` and `lifetime`.
- Monthly checkout uses `PADDLE_PRICE_ID_PRO_MONTHLY`; the actual 3-day trial must also be configured on the Paddle recurring price.
- Trial copy and checkout selection use `PADDLE_TRIAL_DAYS=3`. To remove the trial, set `PADDLE_TRIAL_ENABLED=0` and provide the no-trial Paddle price ids. The old `PADDLE_MONTHLY_TRIAL_*` names still work as compatibility fallbacks.
- Lifetime checkout uses `PADDLE_PRICE_ID_LIFETIME_10_YEAR`, a recurring Paddle price with a 10-year billing cycle. It is handled through `subscription.*` webhooks, not one-time `transaction.completed` webhooks.
- `/api/billing/checkout` returns Paddle.js checkout options for authenticated users.
- `/api/billing/webhook` verifies `Paddle-Signature`, records the Paddle event id in `billing_events`, then updates `subscriptions`.
- `/api/billing/portal` creates a temporary Paddle customer portal link for linked Paddle subscriptions.
- Workspace enforcement is implemented but gated by `PLANMYWORKDAY_BILLING_ENFORCEMENT=1` so credentials and legacy access can be verified before lockout.
- Lifetime can be bought while a Paddle monthly trial/subscription exists. After the verified lifetime subscription webhook is processed, the app schedules the monthly subscription to cancel at `next_billing_period` so trial users are not charged later and paid monthly users stop renewing.
- After lifetime activates as paid access, the app schedules that 10-year Paddle subscription to cancel at the next billing period so it does not renew in ten years.
- If a lifetime row is the effective entitlement but an older Paddle subscription still exists, the sidebar still exposes Manage billing so the user can inspect or cancel the old subscription in Paddle.
- Trial entry should follow the path the user chose. Monthly trial checkout collects card details and converts to monthly after 3 days unless the user cancels during the trial. If a trial is canceled and the user comes back, they can choose monthly again or choose lifetime. Choosing lifetime while monthly/trial exists makes lifetime win and stops the monthly renewal path.

## High-Level Direction

Use:

- Next.js App Router
- React client components for the task editor
- Next Route Handlers for API endpoints
- Drizzle ORM
- PostgreSQL in production
- SQLite only for local prototyping if needed

Do not keep:

- multi-SaaS structure
- payment modules
- habits
- events
- pomodoro
- my-day timeline
- calendar integrations
- mixed routing with `react-router-dom`

## Recommended Product Scope

Core v1:

- authentication
- projects
- hierarchical tasks
- task ordering
- due dates
- task completion
- task metadata
- optimistic task tree editing

Optional v1.5:

- AI planning chat that creates draft tasks

Anything else should be treated as out of scope unless it directly improves task management.

## Architecture Style

Use a modular monolith.

That means:

- one Next.js app
- one deployable unit
- one database
- clear feature boundaries in code

This gives the simplicity of one app without mixing UI, DB, and domain logic into random files.

## Proposed Repo Structure

```text
src/
  app/
    (app)/
      layout.tsx
      page.tsx
      inbox/page.tsx
      projects/page.tsx
      projects/[projectId]/page.tsx
      tasks/[taskId]/page.tsx
      settings/page.tsx
    api/
      projects/route.ts
      projects/[projectId]/route.ts
      projects/[projectId]/tree/route.ts
      tasks/route.ts
      tasks/[taskId]/route.ts
      tasks/operations/route.ts
      planner/stream/route.ts
      planner/chats/[chatId]/commit/route.ts
    layout.tsx
    globals.css

  features/
    auth/
    projects/
      components/
      hooks/
      contracts.ts
    tasks/
      components/
      hooks/
      store/
      tree/
      contracts.ts
    planner/
      components/
      hooks/
      contracts.ts

  server/
    db/
      client.ts
      schema/
        users.ts
        projects.ts
        tasks.ts
        planner.ts
      migrations/
    auth/
      service.ts
    projects/
      repository.ts
      service.ts
    tasks/
      repository.ts
      service.ts
      tree.ts
      operations.ts
      scheduling.ts
    planner/
      service.ts
      streaming.ts

  lib/
    utils/
    constants/
```

## Why This Structure

### `app/`

Routing, layouts, and HTTP entrypoints live here.

### `features/`

Frontend feature code only.

This is where the task tree UI, Zustand store, optimistic operations, and local adapters should live.

### `server/`

All domain logic and DB access.

This is the replacement for the old standalone backend.

### `contracts.ts`

Each feature should expose Zod-backed request/response contracts shared by route handlers and client code.

This reduces drift between frontend expectations and server behavior.

## Database Recommendation

## Short Answer

Use PostgreSQL as the real database.

Keep Drizzle.

Do not make SQLite the long-term production plan.

## Why PostgreSQL

Your task system already has enough complexity that production SQLite will become friction:

- concurrent writes from optimistic autosave
- draft task flows
- batch operations
- future collaboration or background jobs
- safer migrations
- better hosting support

PostgreSQL gives you:

- stronger concurrency behavior
- easier managed hosting
- safer path for future growth
- better operational tooling

## Local Development

You have two acceptable options:

1. PostgreSQL locally too
2. SQLite locally only if you want fast bootstrapping

I recommend PostgreSQL locally as well, so development behavior matches production.

## ORM

Keep Drizzle.

Reasons:

- you already have working schema patterns
- typed SQL fits the current codebase well
- migration path from `atum` is straightforward
- no need to switch tools during a product extraction

## Database Schema

Start with only the tables needed for the focused app.

### `users`

Minimal auth/user identity table.

Suggested fields:

- `id`
- `email`
- `name`
- `image`
- `created_at`
- `updated_at`

### `projects`

Top-level grouping for tasks.

Suggested fields:

- `id`
- `user_id`
- `title`
- `description`
- `status`
- `color`
- `archived`
- `deleted`
- `draft`
- `chat_id` nullable
- `created_at`
- `updated_at`

If AI planner is removed, drop `draft` and `chat_id` from `projects`.

### `tasks`

This is the core table and should stay close to what already works.

Suggested fields:

- `id`
- `user_id`
- `project_id`
- `parent_task_id`
- `client_id`
- `title`
- `description`
- `path`
- `position`
- `due_date`
- `is_completed`
- `priority`
- `estimated_time_minutes`
- `archived`
- `deleted`
- `draft`
- `chat_id` nullable
- `created_at`
- `updated_at`

Important retained concepts:

- `parent_task_id` for hierarchy
- `path` for fast subtree selection
- `position` for fractional ordering
- `client_id` for optimistic sync identity

### `planner_chats` optional

Only keep this if the AI planner survives.

Suggested fields:

- `id`
- `user_id`
- `title`
- `created_at`
- `updated_at`
- `deleted_at`

### `planner_messages` optional

Only if AI planner survives.

Suggested fields:

- `id`
- `chat_id`
- `role`
- `content`
- `created_at`
- `deleted_at`

## DB Rules

### Keep `client_id`

This is important.

The existing task editor depends on stable client-side identities before the backend row id exists.

Without `client_id`, the optimistic operation model becomes much more painful.

### Keep `path`

This is also worth keeping.

It simplifies subtree fetches and scheduled descendant loading.

You could replace it later with recursive queries, but for now the materialized path is pragmatic.

### Keep `position`

The fractional indexing approach is good and should remain.

It avoids mass updates when reordering siblings.

### Draft Fields Are Conditional

If AI planning stays:

- keep `draft`
- keep `chat_id`

If AI planning goes away:

- remove both from initial schema

That is the cleanest split.

## Domain Modules

## 1. Projects

Responsibilities:

- create/update/archive/delete projects
- list projects for the current user
- provide top-level task grouping

Should not know:

- how task tree mutation batching works

## 2. Tasks

Responsibilities:

- create tasks
- update tasks
- soft delete tasks
- fetch project trees
- fetch subtree detail
- apply operation batches
- due-date filtering
- ordering and path maintenance

This is the core module.

## 3. Planner optional

Responsibilities:

- accept user planning prompts
- stream AI response
- create draft tasks
- commit drafts into real tasks

Should be isolated from the core task module.

The task module should not require planner concepts to function.

## Request Flow

### Tree Load

1. Page loads `projects/[projectId]`
2. Server fetches project shell
3. Client task tree requests `/api/projects/[projectId]/tree`
4. Response returns normalized tree payload
5. Client hydrates Zustand store

### Inline Task Creation

1. User types into an ephemeral row
2. Client promotes it to a real local task via `CREATE_TASK`
3. Client emits `UPDATE_TITLE`
4. Autosave batches operations
5. Server resolves by `client_id`
6. UI remains optimistic throughout

### Reorder / Edit / Complete

1. Client applies operation locally
2. Operation enters unsaved queue
3. Debounced sync posts to `/api/tasks/operations`
4. Server validates and persists

### AI Planner optional

1. User sends planner message
2. Server streams model response
3. Planner creates draft tasks/projects
4. Drafts show in planner-scoped task views
5. User commits drafts to main workspace

## API Design

Keep the HTTP surface small.

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/tree`

### Tasks

- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/operations`

### Planner optional

- `POST /api/planner/stream`
- `POST /api/planner/chats/:chatId/commit`
- `GET /api/planner/chats/:chatId`

## Frontend Architecture

The task tree should remain a client-side feature because it has:

- optimistic updates
- local undo/redo
- temporary nodes
- debounced persistence
- rich focus/navigation behavior

Recommended split:

- `features/tasks/components`: React UI
- `features/tasks/store`: Zustand store
- `features/tasks/tree`: pure tree helpers and operation logic
- `features/tasks/hooks`: data hooks and integration helpers

## Keep From Current Frontend

Keep:

- operation model
- optimistic update model
- ephemeral task rows
- undo/redo support
- `clientId` references
- fractional ordering logic

Refactor:

- remove routing assumptions from `react-router-dom`
- remove coupling to unrelated workspace features
- simplify query invalidation and API calls

## Backend Architecture

Each server module should have:

- `repository.ts`: DB reads/writes only
- `service.ts`: business rules
- helper files for focused logic

For tasks:

- `repository.ts`
  raw queries
- `service.ts`
  use-case entrypoints
- `tree.ts`
  build forest, subtree, path helpers
- `operations.ts`
  apply operation batches
- `scheduling.ts`
  due-date filters and timezone conversion

This is cleaner than the current backend spread across controller/model/service files.

## Authentication

Keep this minimal.

Recommended:

- NextAuth/Auth.js or custom session auth
- one `users` table
- server-side session lookup in route handlers

Do not port the old multi-app auth surface unless absolutely necessary.

## Migration Strategy

## Phase 1. Create the new shell

- initialize Next app
- configure TypeScript
- add Drizzle
- add DB connection
- create minimal auth

## Phase 2. Port the database

- create `users`, `projects`, `tasks`
- optionally create planner tables
- run fresh migrations

## Phase 3. Port backend task domain

Move and adapt from `atum`:

- task schema concepts
- task tree building
- task positioning
- operation batch persistence
- due-date conversion logic

Do not port:

- payments
- habits
- events
- pomodoro
- SaaS module wrappers

## Phase 4. Port frontend task tree

Move and adapt from `atum-fe`:

- task tree store
- mutations
- components
- schedule modal

Rewrite:

- routing integration
- API client
- page composition

## Phase 5. Add planner only if needed

If AI planning remains part of the product:

- port chat tables
- port draft commit flow
- port streaming interface

If not:

- skip this entirely

## Phase 6. Hard deletion of non-task scope

Do not leave dead modules around “for later”.

Delete them.

That is how the new app stays focused.

## Recommended Decisions

### Decision 1

Use PostgreSQL + Drizzle.

### Decision 2

Keep `client_id`, `path`, and `position` in `tasks`.

### Decision 3

Keep operation-batch persistence instead of downgrading to naive CRUD.

### Decision 4

Make planner a separate optional module, not part of the core task module.

### Decision 5

Do a selective extraction, not a full merge of `atum` and `atum-fe`.

## Risks

### Risk 1: Porting too much

If unrelated modules are copied over, the new app will inherit the same sprawl.

### Risk 2: Removing `client_id`

This would make optimistic creation and sync much harder.

### Risk 3: Keeping SQLite as production DB

You will likely hit operational friction once autosave and planner writes increase.

### Risk 4: Keeping planner concepts in core task services

This will pollute the domain model if planner is optional.

## Practical Build Order

Recommended implementation order:

1. app shell
2. DB schema
3. auth
4. projects module
5. task repository/service/tree/operations
6. task tree frontend
7. due date and scheduling support
8. planner module if still desired

## Final Recommendation

The right architecture is:

- one Next.js app
- one PostgreSQL database
- Drizzle for schema and queries
- modular monolith structure
- task-centric domain
- planner isolated as optional

The current system already contains a good task engine. The work is not to reinvent it. The work is to extract it cleanly, cut scope aggressively, and re-house it inside a focused Next app.

# Multi-Tenant Implementation

## Purpose
This folder contains the complete documentation, architecture decisions, and phase reports for the Multi-Tenant + Multi-Store MVP implementation in this Medusa repository.

## Phase-Gate Workflow
The implementation follows a strictly controlled, phase-gated workflow. Work is divided into distinct phases. The AI agent will ONLY execute the currently authorized phase and will STOP at the end of each phase. No future-phase work is permitted.

## Status Values
Each phase can have one of the following statuses:
- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED_AWAITING_APPROVAL`
- `APPROVED_BY_USER`

## Approval Command
To approve a phase and allow the agent to proceed to the next phase, the user MUST explicitly provide the approval command:
`APPROVE PHASE <number>` (e.g., `APPROVE PHASE 0`)

## Report Conventions
Each phase requires a comprehensive report located in `phase-reports/`. The agent will complete this report at the end of every phase before requesting approval. Reports cover scope, database changes, commands executed, security observations, and acceptance criteria.

## Architecture Target
The target architecture is a Multi-Tenant + Multi-Store MVP within a single Medusa application and a single shared PostgreSQL database. It utilizes:
- Tenant-aware application context via AsyncLocalStorage.
- PostgreSQL Row Level Security (RLS) for data isolation.
- Medusa Store / Sales Channel / Region links for resource scoping.

## MVP Boundaries
The MVP strictly limits scope to:
- `Platform -> Tenant -> Multiple Stores` hierarchy.
- Tenant-scoped users and platform-level explicit administration.
- Database-enforced isolation.

The following are strictly OUT OF SCOPE unless approved otherwise:
- Separate Medusa instances or databases per tenant.
- Infrastructure orchestration (k8s, ECS, Terraform).
- Billing, subscription plans, usage metering.
- Cross-tenant analytics dashboard.
- Custom Admin UI or Storefront UI.

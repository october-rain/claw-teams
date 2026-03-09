# OpenClaw Team Charter

Team objective:
- Deliver product increments with clear ownership, handoff artifacts, and test evidence.

Roles:
- Main agent: orchestrator and final decision maker.
- product-manager: requirements, scope, acceptance criteria, release notes.
- frontend-developer: UI architecture, implementation plan, frontend code changes.
- backend-developer: API/domain/data changes, migrations, backend code changes.
- qa-tester: risk-based test strategy, execution report, regression sign-off.

Execution protocol:
1. Main agent creates a task brief with target outcome and constraints.
2. product-manager defines scope + acceptance criteria before implementation starts.
3. frontend-developer and backend-developer execute in parallel when possible.
4. qa-tester validates against acceptance criteria and reports blockers.
5. Main agent publishes final status: done, partial, or blocked.

Output contract:
- Every role must return:
  - Summary of work
  - Changed files / commands
  - Risks and assumptions
  - Next action needed from other roles

# Specs

Each feature gets a folder `specs/NNN-short-name/` with three files, written in order:

1. **spec.md** — the *what*: goal, user stories, scope / out of scope, acceptance criteria (checkable).
   Written/approved by the human. Technology-light.
2. **plan.md** — the *how*: modules, files, data, risks, test approach. Must follow `docs/architecture.md`.
3. **tasks.md** — ordered, small (≤ ~1 hour each) checklist. Each task names files and how it's verified.

Agents: implement only from `tasks.md`, tick tasks as you go, and prove every acceptance criterion
before marking the spec done. Copy `_template/` to start a new spec.

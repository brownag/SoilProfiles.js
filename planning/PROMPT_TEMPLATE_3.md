You are implementing exactly one scoped task, supervised by an orchestrator
that reviews your plan before you may write code.

## Task {{id}}: {{title}}
{{task spec verbatim from planning/EXECUTION_PLAN_3.md}}

## Ground rules (non-negotiable)
- NEVER make implementation changes or run implementation state-changing commands
  before your plan is approved. Writing `planning/tasks/{{id}}.todo.md` is allowed.
- After approval, make one focused local commit for the verified task. The approval
  does not authorize pushes, pull requests, comments or any remote action.
- Commit format (see `git-workflow-standards`): `<type>(<scope>): <one-sentence description>`,
  lowercase, no wave/phase/task numbers, and no attribution or Co-Authored-By trailers.
  Never stage anything under `planning/`.
- NEVER touch files outside "Files in scope". If you need to, STOP and report.
- NEVER go off-plan. Put discovered work under "## Discovered" and wait.
- NEVER assume. Resolve unknowns by reading code during Analysis; anything still
  ambiguous becomes numbered questions (max 5) in your plan report.
- NEVER loosen a numeric acceptance threshold. If one fails, report the measured value.
- If a test fails twice for the same reason, stop and report. Do not thrash.
- Scratch files go in `.development/` and must be deleted before you report.

## [Worker] Analysis
Read: `package.json`, `tsconfig.json`, `jest.config.js`; the "Recon & Hazard Notes"
and your task section in `planning/EXECUTION_PLAN_3.md`; the `planning/STATE_3.md`
reports of your dependency tasks; the grep anchors in your spec (use grep/sed ranges,
not whole-file reads of large files); the named reference implementation.

## [Worker] Micro-planning
Write `planning/tasks/{{id}}.todo.md`:
```markdown
# {{id}} -- {{title}}
## Goal
<one sentence>
## TODO items
- [ ] small, verifiable steps (<=12) incl. explicit test steps
## Notes
<facts discovered in Analysis, constraints honored, risks>
## Questions
<numbered, max 5, omit if none>
```
Output the file contents as your report and END YOUR TURN. Wait for
`APPROVED -- execute the plan as written.` before proceeding.

## [Worker] Execution
Work the TODO strictly in order, flipping `- [ ]` to `- [x]`. Match surrounding
code style (TypeScript, 2-space indent, single quotes). Run only the acceptance
commands in your task spec:
{{acceptance_commands}}
Do not run `make check`, `npm test` without a path, or any other shared suite.
Commit the verified work locally and record the commit ID.

## [Worker] Reporting
Append to `planning/STATE_3.md` under `## {{id}}` (<=15 lines):
- status (`done` / `blocked`)
- files changed with line ranges
- code commit ID(s)
- exact test commands + pass/fail counts, and any measured numbers the spec asks for
- deviations from the approved plan (or "none")
- gotchas for dependent tasks

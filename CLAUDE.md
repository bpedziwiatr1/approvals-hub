## Agent skills

### Issue tracker

GitHub Issues in bpedziwiatr1/approvals-hub, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Commits and PRs

- Branching: feature branches start from `develop` and PR into it; `main` takes releases only. See `docs/branching.md`.
- Never add `Co-Authored-By: Claude`, `Claude-Session:` or "Generated with Claude Code" lines to commits or PR bodies. This applies to subagents as well.

## Autonomous implementation rules

Applies to every agent implementing tickets of the spec (#1), including subagents.

- Read `GLOSSARY.md`, `docs/adr/` and the ticket before starting; use glossary terms in code, tests and commits.
- Never ask the user mid-run. When a decision is not settled by the spec, an ADR or the glossary: choose the option that is easiest to reverse and consistent with them, carry on, and record it as a comment on both the ticket and #14 (Ticket / Decision / Alternatives / Why).
- When the ticket contradicts the spec or an ADR, or needs something an agent cannot do (environment access, credentials, a human check): do not work around it. Comment on the ticket, add the `needs-info` label, skip it and take the next ticket on the frontier.
- Never pick up tickets labelled `ready-for-human`, `needs-info` or `wontfix`.
- Work ends with a draft PR on the integration branch; leaving it draft is the expected final state, the human marks it ready and merges. `main` is protected: reach it only through a PR (see `docs/branching.md`).
- Public repo: test data is synthetic, built with factories (`00000000-0000-...` GUIDs, `contoso`, `example.com`). Run `node scripts/check-leaks.mjs` before every commit; it fails on anything that looks like real environment data.
- Models: spawn each ticket's implementer with the `model` named by its `model:*` label (haiku, sonnet, opus); without a label use sonnet. Run merger, exploration and code-review-fix subagents on sonnet. Opus only where a ticket carries the label.
- These rules outrank `/implement-spec` steps that conflict with them: the draft PR stays draft (step 8 does not apply).

## Agent skills

### Issue tracker

GitHub Issues in bpedziwiatr1/approvals-hub, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Commits and PRs

- Never add `Co-Authored-By: Claude`, `Claude-Session:` or "Generated with Claude Code" lines to commits or PR bodies. This applies to subagents as well.

## Autonomous implementation rules

Applies to every agent implementing tickets of the spec (#1), including subagents.

- Read `GLOSSARY.md`, `docs/adr/` and the ticket before starting; use glossary terms in code, tests and commits.
- Never ask the user mid-run. When a decision is not settled by the spec, an ADR or the glossary: choose the option that is easiest to reverse and consistent with them, carry on, and record it as a comment on both the ticket and #14 (Ticket / Decision / Alternatives / Why).
- When the ticket contradicts the spec or an ADR, or needs something an agent cannot do (environment access, credentials, a human check): do not work around it. Comment on the ticket, add the `needs-info` label, skip it and take the next ticket on the frontier.
- Never pick up tickets labelled `ready-for-human`, `needs-info` or `wontfix`.
- Never push to `main`, force-push, or merge the integration PR; it stays a draft for human review.
- Public repo: no customer, environment or person names, URLs or real GUIDs anywhere; test data is synthetic and built with factories.

---
status: proposed
---

# Security roles deferred until after the first deployment

v1 adds no visibility logic of its own: the hub shows exactly what the signed-in user's existing Dataverse roles let them read. Shipping our own roles is deferred until the first version runs in a real environment, because the right depth is unknown: the Approval row is owned by the flow's connection user, not by its Approvers, so User-depth read may hide an Approval from the people asked to decide it, unless the platform shares it with them.

## Candidate once verified

"Approvals Hub User" with Organization read on `msdyn_flow_approval` and `msdyn_flow_approvalstep` and User read on Approval Requests and Approval Responses, plus "Approvals Hub Auditor" with Organization read on all four. Open checks: what the built-in "Approvals User" / "Approvals Administrator" roles grant, and whether an Approver can read the parent Approval with User depth (see `docs/research/approvals-response-mechanism.md`, open questions 7 and 8).

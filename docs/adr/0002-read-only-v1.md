# v1 is read-only: no responding to approvals

Approvals Hub v1 only lists Approvals and their Approval Responses; it offers no approve/reject and no link to respond elsewhere. Research (`docs/research/approvals-response-mechanism.md`) found no supported Dataverse route: there is no action or connector operation for responding, Microsoft states that writing approvals data directly is unsupported and may leave the flow waiting, and the only documented respond endpoint is a Microsoft Graph beta API that needs MSAL.js and an app registration.

## Consequences

- No action layer exists in the code; responding, if added later, is a separate spec (candidate: Graph beta spike).

# Responding to Power Automate approvals from a Dataverse web resource

Research date: 2026-11-15. Scope: an HTML web resource running in a model-driven app iframe, calling Dataverse through `Xrm.WebApi` as the signed-in user, that wants to **respond** (Approve / Reject / custom option, plus a comment) to approvals stored in `msdyn_flow_approval`, `msdyn_flow_approvalrequest`, `msdyn_flow_approvalresponse` and `msdyn_flow_approvalstep`.

Source key: **[MS]** is Microsoft first-party documentation (Learn, the Graph reference, the connector reference, or a Microsoft support KB). **[community / unverified]** is a forum or blog post, or a Q&A answer from a non-Microsoft person. **[inference]** is my own reading of first-party facts that no source states directly.

---

## TL;DR

- **No supported Dataverse route exists for responding.** Dataverse has no action, function, Custom API or SDK message that responds to a Power Automate flow approval. The `CreateApproval` / `approvalprocess` pieces belong to the separate *multistage approvals* feature, and they create approvals; they don't respond to them.
- **Writing `msdyn_flow_approvalresponse` rows directly is explicitly unsupported.** The table metadata does allow Create and Update. But Microsoft's KB says "Writing or modifying approvals data is not supported", and warns that flows waiting on the approval may not continue.
- **The Approvals connector has no "respond" action.** It only offers create, start-and-wait, and wait. So a companion cloud flow can't respond through a supported action either.
- **The only documented programmatic respond API is Microsoft Graph `/beta`:** `POST /solutions/approval/approvalItems/{id}/responses`. It accepts delegated permissions only, and Microsoft says beta APIs are "not supported" for production use. Community reports say it only works for approvals in the **default** environment. Nothing documents that an `approvalItem` id equals `msdyn_flow_approvalid`.
- **Recommendation for v1: read-only hub plus a redirect to respond.** Read and display approvals with `Xrm.WebApi`. For the response itself, send the user to a Microsoft surface (Power Automate Approvals center, Teams Approvals app, or the actionable email). Use the per-approval URL `https://make.powerautomate.com/environments/{environmentId}/approvals/received/{approvalId}`. That URL pattern is **community-reported, not documented**, so verify it, and fall back to the generic Received list if it fails.
- **Possible later option (v2 spike, not v1):** in-page responses through Graph beta with MSAL.js. It is unsupported for production, delegated only, probably limited to the default environment, and needs a spike to confirm that the ids map to each other.

---

## 1. Is there a supported Dataverse action / Custom API / SDK message to respond?

**No.**

- **The approval tables expose only generic CRUD messages.** The table reference pages list Create, Update, Delete, Assign, SetState, Upsert and similar messages. None of them is approval-specific. [MS] [msdyn_flow_approvalresponse](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalresponse), [msdyn_flow_approvalrequest](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalrequest), [msdyn_flow_approval](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approval), [msdyn_flow_approvalstep](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalstep)
- **No source names a respond message.** None of the Microsoft docs I found mention one. This matches your `$metadata`, which has no `approv*` action or function.
- **`approvalprocess` is a different feature.**
  - Its table description is "Approval Process for Multi-Stage Approvals". [MS] [approvalprocess](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/approvalprocess)
  - It is a solution-aware component: it has `solutionid`, `ismanaged` and `componentstate`.
  - It stores its definition in the file columns `stages` ("The stages for the multi-stage approvals") and `inputs` ("The input variables for the multi-stage approvals").
- **What drives multistage approvals.**
  - The *Human in the loop* connector (`advancedapprovals`) has the action **Run a multistage approval (preview)**, operation `StartAndWaitForAnApprovalProcess`, with a required `approvalProcessId` parameter. [MS] [Human in the loop connector](https://learn.microsoft.com/en-us/connectors/advancedapprovals/)
  - The feature is **preview**, available only in **Copilot Studio agent flows**, and it "build[s] upon standard approvals found in cloud flows". [MS] [Multistage and AI approvals in agent flows](https://learn.microsoft.com/en-us/microsoft-copilot-studio/flows-advanced-approvals)
  - Approvers respond the same way as for standard approvals: Teams Approvals app, Outlook, or the Power Automate portal. The same page lists no API for responding. [MS] (same page)
- **`CreateApproval` Custom API: no public docs found.** **[inference]** Its name and its binding to `approvalprocess` suggest it is the internal entry point that *starts* a multistage approval from an approval process. It is not a respond mechanism, and it doesn't apply to approvals created by the standard Approvals connector.
- **The linking column.** `msdyn_flow_approval.processid` is described as "The id of the approval process from which the approval is created". [MS] [msdyn_flow_approval](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approval)
  - **[inference]** This column links a flow approval row to an `approvalprocess` (multistage). It is not a link to the cloud flow (`workflow`).
  - The related column `currentstage` looks up to `approvalstageorder` ("current stage of the multi stage approvals"). (same page)
- **`SetApprovalStatusForMailboxes` is unrelated.** It belongs to Exchange mailbox approval for server-side sync.
- **The Approvals Kit is also separate.** It is another Microsoft solution with its own custom tables, and it is not the `msdyn_flow_*` engine. [MS] [Approvals kit content overview](https://learn.microsoft.com/en-us/power-automate/guidance/business-approvals-templates/content)

## 2. Is creating `msdyn_flow_approvalresponse` (or updating `msdyn_flow_approvalrequest`) directly supported? Does the flow resume?

**It is technically writable but explicitly unsupported, and resumption is not guaranteed.**

**What the metadata allows:**

- **Both tables are standard and `UserOwned`**, and both list `Create` and `Update` messages. [MS] [msdyn_flow_approvalresponse](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalresponse)
- **Response columns that return true for IsValidForCreate or IsValidForUpdate** include:
  - `msdyn_flow_approvalresponse_approval` (lookup, ApplicationRequired)
  - `msdyn_flow_approvalresponse_response` (string 100, ApplicationRequired)
  - `msdyn_flow_approvalresponse_comments` (string 4000)
  - `msdyn_flow_approvalresponse_approvalstagekey` (ApplicationRequired)
  - `msdyn_flow_approvalresponse_stage`
  - `msdyn_flow_approvalresponse_stepnumber`
  - the `...idx_approvalid`, `...idx_owninguserid` and `...idx_stage` constraint-index mirrors
  - `ownerid`, `statecode`, `statuscode`
- **So a raw `POST /msdyn_flow_approvalresponses` will probably pass metadata validation.** The answer to "is it valid for create" is yes.

**What Microsoft says:**

- **The Microsoft support KB 4559582**, *"Guidance for custom solutions using Approvals data stored in CDS"*, says [MS] [KB 4559582 (original URL)](https://support.microsoft.com/en-us/help/4559582/guidance-for-custom-solutions-using-approvals-data-stored-in-cds):
  - "Manipulation of Power Automate Approvals data in CDS is NOT supported. Writing or modifying approvals data is not supported."
  - Changes made outside the official clients may not be processed by the approvals response state machine, and **flows waiting on the approval may not continue**.
  - Third-party changes may leave approvals in an incomplete or untrustworthy state.
  - "The schema is complex, not publicly documented and is subject to change."
  - Supported uses are read-only: triggering on create or modify, listing incomplete approvals, and building apps that list approvals.
- **Source status.** The original URL now 301-redirects to the Learn *Get started with approvals* page, which no longer carries this text. The KB content is still readable on a mirror: [mskb.pkisolutions.com/kb/4559582](https://mskb.pkisolutions.com/kb/4559582). I found nothing newer from Microsoft that reverses it.
- **A Dataverse-backed plugin can break approvals.** For `XrmApprovalsGeneralPermissionsError`, Microsoft says to make sure no custom plugins restrict access to the approvals tables for users or for the Power Automate service principal that provisions records. Microsoft-side service identities are actively writing to these tables. [MS] [Troubleshoot approvals errors](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/approvals/common-errors-creating-and-assigning-flow-approvals)
- **One ambiguous doc sentence.** The known-issues page, under *Split create and wait actions*, suggests you "change the status of the approval in Dataverse before you call the wait action". [MS] [Approvals known issues](https://learn.microsoft.com/en-us/power-automate/approvals-known-issues)
  - This is the only first-party hint that a Dataverse-side change is ever expected, and it concerns the approval's status before a wait starts. It is not about submitting a response.
  - It doesn't override the KB.

**Does the flow resume?**

- **Not documented, and Microsoft warns it may not.** **[inference]**
  - The rows carry service-maintained state that a hand-made row would have to reproduce: `approvalstagekey`, the `idx_*` constraint-index mirrors, `statuscode` Reviewing / Saved / Committed, and the request's Active / Inactive / Reassigned status.
  - Outcome aggregation for "everyone must approve" and custom options happens in the Approvals service, and so does the webhook callback that wakes the flow.
- **Decision: don't build on it.** A one-off experiment in a sandbox is the only way to see the current behaviour, and even a positive result would be unsupported and fragile.

## 3. Approvals service API / connector, Graph, CORS, and deep links

**Approvals connector**

- **Actions:** Create an approval, Start and wait for an approval, Start and wait for an approval of text, Wait for an approval, plus deprecated variants. There is **no respond, update, or cancel-by-id action**. [MS] [Approvals connector reference](https://learn.microsoft.com/en-us/connectors/approvals/)
- **Valid responses for Basic and Await-all types are `Approve` and `Reject`, and they are case-sensitive.** (same page)
- **Custom notification emails are never actionable.** The connector reference says "Users can choose to send their own email notification with a link to the approval, but those emails will not be actionable". (same page)
- **Connectors are not callable from a browser.** **[inference]** A connector is an action inside a flow, not an API that a browser web resource can call.

**Power Automate service ("Flow RP") API**

- **No public documentation exists for an approvals respond endpoint** on the Power Automate service API (`api.flow.microsoft.com`).
- **One forum poster says they moved to "the Power Automate approvals API" and it worked.** No endpoint, permissions or support statement is given. **[community / unverified]** [Tech Community thread](https://techcommunity.microsoft.com/discussions/teamsdeveloper/approvals-api-only-working-in-the-default-environment/4420994)
- **Treat it as private.**

**Microsoft Graph Approvals API (beta): the only documented respond endpoint**

- **What it is.** The API "allows you to integrate approval workflows into both Teams app and non-Microsoft apps", including creating, updating and listing approvals and receiving notifications. [MS] [Approvals app APIs overview](https://learn.microsoft.com/en-us/graph/approvals-app-api)
- **Respond request.** [MS] [Create approvalItemResponse](https://learn.microsoft.com/en-us/graph/api/approvalitem-post-responses?view=graph-rest-beta)
  ```http
  POST https://graph.microsoft.com/beta/solutions/approval/approvalItems/{approvalItemId}/responses
  Content-Type: application/json

  { "response": "Approve", "comments": "optional comment" }
  ```
  - The call returns `202 Accepted` with an operation `Location` header.
  - Permissions are **delegated work or school only**: `ApprovalSolution.ReadWrite` (least privileged) or `ApprovalSolutionResponse.ReadWrite`. Application permissions are **not supported**.
  - It is available only in the global cloud.
- **Listing approvals.** `GET /solutions/approval/approvalItems` supports `$filter`, `$orderby`, `$top`, `$count` and `$select`. Delegated `ApprovalSolution.Read` is enough. [MS] [List approvalItems](https://learn.microsoft.com/en-us/graph/api/approvalsolution-list-approvalitems?view=graph-rest-beta)
- **Resource model.** [MS] [approvalItem resource](https://learn.microsoft.com/en-us/graph/api/resources/approvalitem?view=graph-rest-beta)
  - `approvalItem` has `approvalType` (`basic`, `basicAwaitAll`, `custom`, `customAwaitAll`), `responsePrompts`, `state` (`canceled`, `created`, `pending`, `completed`) and `result`.
  - It also has `requests` and `responses` relationships that mirror the Dataverse tables.
- **Production status.** Every page carries the banner "APIs under the `/beta` version ... Use of these APIs in production applications is not supported." [MS] (same pages)
- **Environment scope.**
  - **One community report:** the API worked in the default environment and returned 404 in other environments. Microsoft never answered. **[community / unverified]** [Tech Community thread](https://techcommunity.microsoft.com/discussions/teamsdeveloper/approvals-api-only-working-in-the-default-environment/4420994)
  - **Consistent with this:** the Teams Approvals app provisions and stores its approvals in the **default** Dataverse environment. [MS] [Manage the Approvals app in Teams](https://learn.microsoft.com/en-us/microsoftteams/approval-admin)
- **Id mapping.** Nothing documents whether `approvalItem.id` equals `msdyn_flow_approvalid`, or whether Graph returns approvals created by cloud flows. **[inference]** It is plausible because both front the same Approvals service, but it is unverified.

**Calling Graph from a web resource (browser, Entra ID tokens, CORS)**

- **The Dataverse token can't be reused.** `Xrm.WebApi` uses the model-driven session's Dataverse token, which is not a Graph token. **[inference]**
- **You would need MSAL.js in the web resource**, with:
  - an Entra app registration whose **Single-page application** redirect URI points at the web resource or org URL;
  - admin consent for the `ApprovalSolution*` scopes;
  - the auth-code + PKCE flow. Microsoft recommends MSAL.js 2.x+ with that flow for SPAs. [MS] [Tutorial: JavaScript SPA calling Graph](https://learn.microsoft.com/en-us/azure/active-directory/develop/tutorial-v2-javascript-spa)
- **Microsoft's Dataverse SPA guidance states MSAL.js handles the CORS complexity.** [MS] [Use OAuth with CORS to connect a SPA](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/oauth-cross-origin-resource-sharing-connect-single-page-application) Graph is designed to be called from SPAs, but I found no page stating Graph's CORS policy outright.
- **Iframe sign-in is a practical risk.** Silent token acquisition inside a model-driven iframe needs testing, because popups, third-party cookies and Conditional Access can all interfere. **[inference]**

**Deep links (the v1 fallback)**

- **Documented navigation:** sign in to `https://make.powerautomate.com`, then **Action items > Approvals > Received**. Users can approve or reject there with a comment. [MS] [View, approve, or reject approval requests](https://learn.microsoft.com/en-us/power-automate/approve-reject-requests)
- **Respond link output.** Downstream metadata of the approval actions includes a **Respond link** and the **Approval ID**. [MS] [Training: Types of approval actions](https://learn.microsoft.com/en-us/training/modules/approvals-power-automate/2-types)
  - **[inference]** A flow can therefore write the official respond link into your own table if you need an exact link.
  - The output is not stored in a documented `msdyn_flow_*` column.
- **Per-approval URL [community / unverified].**
  - **Pattern:** `https://make.powerautomate.com/environments/{environmentId}/approvals/received/{approvalId}`. It opens the approval in the portal's side panel, which can truncate long markdown details. [Q&A: Deeplink to specific approvals in Teams](https://learn.microsoft.com/en-us/answers/questions/1187632/deeplink-to-specific-approvals-in-teams)
  - **Older or regional hosts** also appear, such as `https://{region}.flow.microsoft.com/manage/environments/{environmentId}/approvals/received/{approvalId}`, optionally followed by `/requests/{requestId}`. [Community search results](https://powerusers.microsoft.com/t5/General-Power-Automate/Generic-link-to-view-of-approvals/m-p/263364)
  - **Treat `{approvalId}` as `msdyn_flow_approvalid`** and verify it.
- **Teams Approvals app [community / unverified].**
  - **List link:** `https://teams.microsoft.com/l/entity/{approvalsTeamsAppId}/approvals`. The GUID is the public Teams app id of the Approvals app; it also appears in the Teams admin center link in the [MS] admin doc.
  - **No working per-approval Teams deep link has been confirmed.** [Q&A thread](https://learn.microsoft.com/en-us/answers/questions/1187632/deeplink-to-specific-approvals-in-teams)
- **Guest users can't use actionable Outlook messages** and need the Power Automate portal, so they require a portal licence. [MS] [Approvals connector](https://learn.microsoft.com/en-us/connectors/approvals/), [Known issues](https://learn.microsoft.com/en-us/power-automate/approvals-known-issues)

## 4. Other routes and their trade-offs

| Route | Supported? | Responder identity | Notes |
|---|---|---|---|
| **Redirect to Approvals center / Teams / email** | Yes (Microsoft UIs) | Real approver | Simplest option. The per-approval URL format is community-sourced (see §3). The user leaves the hub briefly. |
| **Companion cloud flow** triggered by HTTP or by a row in a custom "response command" table | The trigger is supported, the respond step is not | — | The Approvals connector **has no respond action** [MS] [connector](https://learn.microsoft.com/en-us/connectors/approvals/). The flow could only (a) write `msdyn_flow_approvalresponse`, which is unsupported (§2), or (b) call Graph beta through an HTTP connector with delegated auth, which records the **connection owner**, not the approver, as responder. **[inference]** The identity is wrong either way. Not viable. |
| **Graph beta from the web resource (MSAL.js)** | Documented but "not supported" in production | Real approver (delegated) | Needs an app registration and admin consent. Likely limited to the default environment, and the id mapping is unverified. Candidate for a v2 spike. |
| **Direct Dataverse write from the web resource** | **Explicitly unsupported** [MS] [KB 4559582](https://mskb.pkisolutions.com/kb/4559582) | Real approver (row owner) | The flow may never resume, and the schema may change. Don't use. |
| **Outlook actionable messages** | Yes, but only the system-sent email | Real approver | Custom emails "will not be actionable" [MS] [connector](https://learn.microsoft.com/en-us/connectors/approvals/). You can't embed actionable buttons in the hub. |
| **Redesign the source flows**: replace Approvals with a custom Dataverse table, plus a flow that waits on row changes or posts an adaptive card | Yes (your own data) | Real approver | Gives full control and an in-hub respond button. Only works for flows you own, and you lose the Approvals center, Teams and email integration. |

## 5. Item link and source-identifying fields

**Item link**

- **Connector inputs.** The connector takes **Item Link** (`itemLink`, "Add a link to the item to approve") and **Item Link Description** (`itemLinkDescription`, "Describe the link to the item") and echoes both in its outputs. [MS] [Approvals connector](https://learn.microsoft.com/en-us/connectors/approvals/)
- **Dataverse columns.** `msdyn_flow_approval_itemlink` ("The optional link to the item to approve") and `msdyn_flow_approval_itemlinkdescription` ("The optional description for the item link"). There is also `msdyn_flow_approval_itemlinkhash` ("Item link hash to enable queries"). [MS] [msdyn_flow_approval](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approval)
- **Mapping.** **[inference]** The flow's *Item link* / *Item link description* inputs are stored verbatim in these two columns. Both are optional, so they are empty unless the flow maker filled them in. The hash enables equality lookups without filtering on a long URL. Verify the hash algorithm before relying on it.

**Other identifying fields on `msdyn_flow_approval`** [MS] (same page)

- `msdyn_flow_approval_source`: string, "Source of the request that created the approval". The values are not documented.
- `msdyn_flow_approval_partnermetadata` (memo, "Unstructured space ... for partner services") and `msdyn_flow_approval_partneridhash` ("hash of a unique partner id associated with a document").
  - These correspond to the connector's `partnerMetadata` / `partnerId` inputs. [MS] [connector](https://learn.microsoft.com/en-us/connectors/approvals/) **[inference]** The mapping is by name.
  - `msdyn_flow_approvalrequest_partnermetadata` exists per request as well. [MS] [msdyn_flow_approvalrequest](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalrequest)
- `processid`: the multistage approval process id (see §1), **not** the cloud flow id.
- Template-related columns: `msdyn_flow_approval_requesttype`, `msdyn_flow_approval_templateid`, `msdyn_flow_approval_templateformid`, `msdyn_flow_approval_templateresponseid`.
- Model columns: `msdyn_flow_approval_modeltype` ("Table name of the approval model"), `msdyn_flow_approval_modelid`, and the `msdyn_flow_approval_basicapprovalmodel` lookup.
- Other columns: `msdyn_flow_approval_category` and `msdyn_flow_approval_tags`.
- `msdyn_flow_approval_additionalfields` (memo): no description.
- **No documented column holds the source cloud flow id or run id.** If the hub must show "which flow", have flow makers put it in Item link, Category or Tags, or verify what `source` and `additionalfields` contain in a real environment.
- **Who appears as sender.** The *flow creator* is always shown as the approval sender, to prevent spoofing. [MS] [connector](https://learn.microsoft.com/en-us/connectors/approvals/)

## 6. Privileges, roles and ownership

**Ownership**

- **Owners, per Microsoft's KB** [MS] [KB 4559582](https://mskb.pkisolutions.com/kb/4559582):
  - **`msdyn_flow_approval`:** one row per approval, owned by the **flow's Approvals connection user**, or by the on-behalf-of owner if one was specified.
  - **`msdyn_flow_approvalrequest`:** one row per recipient, **owned by that recipient**.
  - **`msdyn_flow_approvalresponse`:** created when a recipient responds, owned by the responder. Your sample agrees.
  - **When termination criteria are met,** the approval is set inactive.
- **"Created by Microsoft Flow CDS Integration Service" is expected.** That is one of the two Entra apps Approvals requires, alongside "Microsoft Flow Service". The service principal that provisions records also appears as `flowdev@microsoft.com`. [MS] [Troubleshoot approvals errors](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/approvals/common-errors-creating-and-assigning-flow-approvals)
- **All four tables are `UserOwned`**, so the standard depths apply: User, Business Unit, Parent:Child BU, Organization. [MS] [Security roles and privileges](https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges)
- **Steps cascade from the approval.** `msdyn_flow_approvalstep` relates to `msdyn_flow_approval` with Delete and Archive set to cascade. [MS] [msdyn_flow_approvalstep](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalstep)

**Built-in roles (documented facts only)**

- **Approvals User.** Users assigned an approval who aren't in the environment get the *Approvals User* role automatically, and "need this role for their responses to be processed and persisted". [MS] [Get started with approvals](https://learn.microsoft.com/en-us/power-automate/get-started-approvals)
  - Teams Approvals users are added to *Approvals User* on their first assignment. [MS] [Teams Approvals admin](https://learn.microsoft.com/en-us/microsoftteams/approval-admin)
- **Approvals Administrator.** It is named in `XrmApprovalsGeneralPermissionsError`: "could be caused by modification of the approvals administrator or user roles". [MS] [Troubleshoot](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/approvals/common-errors-creating-and-assigning-flow-approvals)
- **The privilege matrix of either role is not documented.**
- **Community:** don't modify the built-in *Approvals User*. Assign it **directly**, not via a team, and keep it valid for the user's business unit. Custom look-alike roles have caused failures. **[community / unverified]** [KA-26002](https://community.powerplatform.com/article/KA-26002)
- **Community:** some fixes involved `prvReadAsyncOperation` (System Job read) and `prvReadmsdyn_flow_actionapprovalmodel`. **[community / unverified]** [Forum](https://powerusers.microsoft.com/t5/Using-Flows/Approval-action-fails-with-XrmApprovalsGeneralPermissionsError/m-p/2580277)

**Read-only custom role for the hub** **[inference]**, to validate in an environment:

- **Read on `msdyn_flow_approvalrequest`, User depth.** Approvers own their request rows.
- **Read on `msdyn_flow_approvalresponse`, User depth for own responses.** Use Business Unit or Organization depth only if the hub shows *other* approvers' responses, for example in everyone-must-approve progress.
- **Read on `msdyn_flow_approval`: User depth is NOT enough.** The approver doesn't own the parent row; the flow connection user does. Options:
  - (a) Organization or Business Unit read, which exposes every approval's title and details in scope, so check privacy first;
  - (b) rely on whatever *Approvals User* already grants and inspect it in your environment;
  - (c) check whether the service shares the approval with recipients. Look for POA rows or a `RetrievePrincipalAccess` result.
- **Read on `msdyn_flow_approvalstep`.** It is owned by the service or flow user, so the same caveat as `msdyn_flow_approval` applies.
- **Read on `systemuser`** to resolve owners. Read on the `msdyn_flow_*approvalmodel` tables only if you `$expand` into them.
- **For responding:** no custom role makes a direct write supported. **Do not grant Create on `msdyn_flow_approvalresponse`** for this purpose. Responding through the Microsoft UIs needs only the built-in *Approvals User*.
- **Plugins:** don't add custom plugins or business rules that restrict these tables. They can break the service's own writes. [MS] [Troubleshoot](https://learn.microsoft.com/en-us/troubleshoot/power-platform/power-automate/approvals/common-errors-creating-and-assigning-flow-approvals)

## 7. Option values

All values below come from the Dataverse table reference unless noted. [MS] [msdyn_flow_approval](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approval), [msdyn_flow_approvalrequest](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalrequest), [msdyn_flow_approvalresponse](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalresponse), [msdyn_flow_approvalstep](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/msdyn_flow_approvalstep)

**`*_stage`** (global choice `msdyn_flow_approvalstage`, shared by approval, request, response and step)

| Value | Label |
|---|---|
| 192350000 | Not Specified |
| 192350001 | Basic |
| 192351000 | Complete |

**`msdyn_flow_approval` statecode / statuscode**

| statecode | statuscode | Label |
|---|---|---|
| 0 Active | 192350000 | Created (default) |
| 0 Active | 192350001 | Pending |
| 0 Active | 192350002 | Suspended |
| 1 Inactive | 192350004 | Completed (default) |
| 1 Inactive | 192350005 | Expired |
| 1 Inactive | 192350006 | Canceled |
| 1 Inactive | 192350007 | Abandoned |

- Abandoned approvals can exist after the flow times out; a flow waits at most 28 days. [MS] [Known issues](https://learn.microsoft.com/en-us/power-automate/approvals-known-issues)

**`msdyn_flow_approvalrequest` statecode / statuscode:** 0 Active → 1 Active; 1 Inactive → 2 Inactive or 192350000 **Reassigned**. Default for Inactive is 192350000.

**`msdyn_flow_approvalresponse` statecode / statuscode:** 0 Active → 192350000 Reviewing (default) or 192350001 Saved; 1 Inactive → 192350002 **Committed** (default).
- **[inference]** Only *Committed* responses are final.

**`msdyn_flow_approvalstep` statuscode:** 1 Active, 2 Inactive.

**`msdyn_flow_approval_result`:** a **string**, not a choice ("Final outcome of the approval").
- The connector says Basic and Await-all responses are exactly `Approve` / `Reject` (case-sensitive). [MS] [connector](https://learn.microsoft.com/en-us/connectors/approvals/)
- The Graph `approvalItem.result` doc says "Approved" / "Rejected" for basic, and semicolon-separated values for custom. [MS] [approvalItem](https://learn.microsoft.com/en-us/graph/api/resources/approvalitem?view=graph-rest-beta)
- These two sources conflict. Check the stored value in Dataverse, and expect custom option text for custom approvals. A `Canceled` outcome is also possible. [MS] [Known issues](https://learn.microsoft.com/en-us/power-automate/approvals-known-issues)

**`msdyn_flow_approvalrequest_responseoptionstype`** (global choice `msdyn_flow_approvalresponseoptionstype`)

| Value | Label |
|---|---|
| 192350000 | NotSpecified (default) |
| 192350001 | BasicApproveReject |
| 192350002 | CustomOptions |

- The options themselves are in `msdyn_flow_approvalrequest_responseoptions` ("comma-separated", max 2048) and `msdyn_flow_approvalrequest_options` (memo, "The set of available response options"; the format is undocumented, probably JSON).

**`msdyn_flow_approval_requesttype`** ("The type of request that created the approval whether from an approval template, esignature process, etc.")

| Value | Label |
|---|---|
| 192350000 | Other |
| 192350001 | Basic |
| 192350002 | eSign |
| 192350003 | Templates |

**`msdyn_flow_approval_priority`:** 192350000 Urgent, 192350001 Important, 192350002 Medium, 192350003 Low.

---

## Open questions to verify in an environment

1. **Deep link.** Does `https://make.powerautomate.com/environments/{environmentId}/approvals/received/{msdyn_flow_approvalid}` open the specific approval with response buttons, for basic, custom, everyone-must-approve and sequential types? Does it work when opened from inside the model-driven app, as a new tab rather than inside the iframe?
2. **Teams.** Can any `teams.microsoft.com/l/entity/{approvalsTeamsAppId}/...` link with a `context` / `subEntityId` open a single approval?
3. **Graph spike, approval ids.** In the default environment, does `GET /beta/solutions/approval/approvalItems` list approvals created by **cloud flows**? Is `approvalItem.id` equal to `msdyn_flow_approvalid`?
4. **Graph spike, other environments.** Does the same call work for a **non-default** environment? Community says 404.
5. **Graph spike, flow resume.** After a Graph `POST .../responses`, does the waiting flow resume? Does it write a `msdyn_flow_approvalresponse` row with statuscode *Committed*?
6. **Graph spike, sign-in.** Can MSAL.js acquire a Graph token silently inside the model-driven iframe under the tenant's Conditional Access policy?
7. **Built-in roles.** What depth do *Approvals User* and *Approvals Administrator* grant on `msdyn_flow_approval`, `msdyn_flow_approvalrequest`, `msdyn_flow_approvalresponse` and `msdyn_flow_approvalstep`? Export both roles and compare.
8. **Sharing.** Can an approver who is not the owner read the parent `msdyn_flow_approval` row with User-depth read? Check `RetrievePrincipalAccess` and `principalobjectattributeaccess` / sharing for that row.
9. **Stored values.** What values actually appear in `msdyn_flow_approval_source`, `msdyn_flow_approval_additionalfields`, `msdyn_flow_approval_result` (`Approve` or `Approved`) and `msdyn_flow_approvalrequest_options`?
10. **Item link hash.** Is `msdyn_flow_approval_itemlinkhash` reproducible client-side, so the hub can do "approvals for this record" lookups?
11. **Sandbox-only negative test** (to document, not to ship). Does a hand-crafted `msdyn_flow_approvalresponse` create resume the flow or not? Record the result for the decision log.

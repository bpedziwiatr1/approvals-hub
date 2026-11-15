# Approvals Hub

A read-only page inside a model-driven app that lists Power Automate approvals stored in Dataverse and shows their responses. It knows nothing about what the approvals are for.

## Language

**Approval**:
A single item someone asked to have decided, created by a flow, with a title, details and an outcome.
_Avoid_: Request, wniosek (in code and docs), ticket

**Approval Request**:
One approver's assignment within an Approval: the record that says this person is asked to decide.
_Avoid_: Request (bare), task, assignment

**Approval Response**:
The decision one approver gave on an Approval, with an optional comment.
_Avoid_: Answer, reply, vote

**Approval Step**:
One stage of a multi-stage Approval; a single-stage Approval has no separate steps.
_Avoid_: Stage, level

**Approver**:
A person who received an Approval Request.
_Avoid_: Reviewer, assignee

**Regarding Record**:
The Dataverse record an Approval is about, when one can be identified from the Approval.
_Avoid_: Source record, item, related record

**Profile**:
A named configuration of the page, selected by a menu entry, that sets its title, columns and Profile Scope.
_Avoid_: View, config, mode

**Profile Scope**:
The fixed filter a Profile applies, which users cannot remove; every criterion it sets must match.
_Avoid_: Fixed filter, approval type, category filter

**Owner**:
The user whose flow connection created the Approval; not necessarily the person who asked for it.
_Avoid_: Creator, requestor, author

**Outcome**:
The final result of an Approval once it is completed (one of its response options, or cancelled).
_Avoid_: Status, result, decision

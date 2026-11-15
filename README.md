# Approval-Hub
Power platform Model-driven app Approval Hub

## Solution and release

The Dataverse solution `ApprovalsHub` lives unpacked in `solution/src`. `scripts/build-solution.ps1` (or `.sh`) builds the page, copies it into the solution and packs `out/ApprovalsHub_<version>_managed.zip` and `_unmanaged.zip` with the Power Platform CLI (`pac`). The solution version must equal the `package.json` version (checked by `npm run check`). release-please keeps both in step and the release workflow attaches the zips to the GitHub Release.

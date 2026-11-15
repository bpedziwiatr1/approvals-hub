# Branching

Gitflow, reduced to two long-lived branches.

- `develop`: ongoing work. Feature and fix branches start here and merge back through a pull request. CI runs on every pull request.
- `main`: released code only. It changes only by merging `develop` through a pull request; each release is a tag `vX.Y.Z` with a GitHub Release carrying the solution zips.

## Releasing

1. Merge `develop` into `main` with a pull request (merge commit, not squash, so `develop` and `main` keep a common history).
2. release-please opens or updates the pull request "release X.Y.Z" on `main`. Merging it creates the tag and the GitHub Release; the `pack` job attaches `ApprovalsHub_<version>_managed.zip` and `_unmanaged.zip`.
3. Merge `main` back into `develop` with a pull request so the version bump and changelog reach `develop`.

A fix for a released version starts from `main` as `hotfix/<name>`, merges into `main` by pull request, and is merged back into `develop` the same way.

Commit messages are Conventional Commits; release-please derives the version from them.

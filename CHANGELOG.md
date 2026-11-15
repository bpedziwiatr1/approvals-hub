# Changelog

## 1.0.0 (2026-11-15)


### Features

* add Dataverse solution sources and release workflow ([ae76222](https://github.com/bpedziwiatr1/approvals-hub/commit/ae7622223adae2104856233b8bc0eb4b35777f88))
* Approvals Hub v1 (read-only) ([aaef733](https://github.com/bpedziwiatr1/approvals-hub/commit/aaef733988beeae6c6cade489186c3df9d2a1b74))
* **config:** grid columns owner, currentStep and lastDecision for profiles ([#7](https://github.com/bpedziwiatr1/approvals-hub/issues/7)) ([dcd2c52](https://github.com/bpedziwiatr1/approvals-hub/commit/dcd2c52278d0b1fa2bb2dd59aab48168295c11b5))
* **data:** list columns for owner, current step and last decision, with server sort ([#3](https://github.com/bpedziwiatr1/approvals-hub/issues/3)) ([4a36de6](https://github.com/bpedziwiatr1/approvals-hub/commit/4a36de67e55044cb332e90881e1e2445824ce342))
* failure-mode states, narrow-width drawer, axe checks and reliable E2E suite ([2b85f53](https://github.com/bpedziwiatr1/approvals-hub/commit/2b85f5369ec0cf4c9b227f1e842918996b2f8e03))
* filter by owner, approver, created-on range and assigned to me ([83aa238](https://github.com/bpedziwiatr1/approvals-hub/commit/83aa2380d6c80c5ed53fd0a96e67812c8a2cc67e))
* language and time zone from the user's Dataverse settings ([#3](https://github.com/bpedziwiatr1/approvals-hub/issues/3), [#8](https://github.com/bpedziwiatr1/approvals-hub/issues/8)) ([4c9a060](https://github.com/bpedziwiatr1/approvals-hub/commit/4c9a060aff5cb3f264934365566683260aee78fa))
* list Approvals from Dataverse through xrmClient ([1c22d95](https://github.com/bpedziwiatr1/approvals-hub/commit/1c22d95d172434badb5d0db63d259add40e0a493)), closes [#3](https://github.com/bpedziwiatr1/approvals-hub/issues/3)
* open the Regarding Record from the detail pane ([ad837c1](https://github.com/bpedziwiatr1/approvals-hub/commit/ad837c19626bd2662130e7b927b44abba15d6b36))
* profiles and profile scope from the environment variable ([e0e8a61](https://github.com/bpedziwiatr1/approvals-hub/commit/e0e8a613292dc9b0370e597c00aaeb1b67e0e0b8)), closes [#7](https://github.com/bpedziwiatr1/approvals-hub/issues/7)
* server-side title search and status filter with URL round-trip ([4fc6979](https://github.com/bpedziwiatr1/approvals-hub/commit/4fc6979e66bbfc8988a2c4f0fef0c750f3d815a8))
* show approval detail pane with response timeline ([3174528](https://github.com/bpedziwiatr1/approvals-hub/commit/317452850e37d32eed76ba0eb48f9107aabede32))
* summary tiles, refresh and CSV export ([b6af20f](https://github.com/bpedziwiatr1/approvals-hub/commit/b6af20f15da51224cf3f4c84c43e880420b6b27d))
* **ui:** data grid with server sort and resizable columns, App split by reason ([#3](https://github.com/bpedziwiatr1/approvals-hub/issues/3)) ([913661d](https://github.com/bpedziwiatr1/approvals-hub/commit/913661d615eb4593cb7cc0c83bffc98e8c7342ee))
* walking skeleton listing approvals from mockClient ([4a01575](https://github.com/bpedziwiatr1/approvals-hub/commit/4a0157580a0308eec8559fe56923ab830dfaa4a3))


### Bug Fixes

* **config:** built-in default status is Pending ([#7](https://github.com/bpedziwiatr1/approvals-hub/issues/7)) ([07aa608](https://github.com/bpedziwiatr1/approvals-hub/commit/07aa608b06bf45b1c0a9aefb51e8f11403eeb737))
* **solution:** author unpacked components in the layout pac expects ([#11](https://github.com/bpedziwiatr1/approvals-hub/issues/11)) ([ceec2e5](https://github.com/bpedziwiatr1/approvals-hub/commit/ceec2e51a0d002b5b26da6e798ebf866279a4937))
* **solution:** pack the managed zip from the unmanaged sitemap ([#11](https://github.com/bpedziwiatr1/approvals-hub/issues/11)) ([2f62fa8](https://github.com/bpedziwiatr1/approvals-hub/commit/2f62fa8c66dbcaab9412ca0ed0a0440594ae8dbf))


### Performance Improvements

* **data:** count by status with one $apply aggregate instead of paging every row ([#9](https://github.com/bpedziwiatr1/approvals-hub/issues/9)) ([87b36f4](https://github.com/bpedziwiatr1/approvals-hub/commit/87b36f4ba1a7e04246af5e82c3d9e4806a9ecfd1))

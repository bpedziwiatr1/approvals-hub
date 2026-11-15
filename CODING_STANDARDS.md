# Coding standards

Read during review, not implementation. Mechanical rules live in `eslint.config.js`, the hooks in `.husky/` and CI; this file holds judgement calls only.

- **Split by reason to change.** A module changes for one reason (data access, one UI region, config parsing). When a component mixes layout, state and formatting, split it along those reasons.
- **One source of truth per table.** A value list used by UI and data (statuses, columns, sort keys) is declared once and imported; a second copy is a defect.
- **Glossary names.** Identifiers, test titles and i18n keys use `GLOSSARY.md` terms. A name that hides what it holds (`text`, `data`, `value`) is renamed to what it returns (`stringOrNull`).
- **Test data via factories.** Fixtures come from `src/data/factories.ts`; inline literals only for the value under test.
- **Spec trace.** Each user story of the ticket maps to a test; a story with no test is reported as missing.

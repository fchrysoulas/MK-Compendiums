# Agent Instructions

## Project Overview

MK-Compendiums is a small, system-agnostic Foundry VTT module. It is loaded directly by Foundry from `module.json` and `scripts/main.js`; there is no package manager, bundler, transpiler, or checked-in test runner in this repo.

The module supports Foundry VTT v12, v13, and v14 from one package. Preserve that broad compatibility when changing Foundry APIs.

## Repository Layout

- `module.json` is the Foundry manifest and release metadata source.
- `scripts/main.js` registers settings, hooks, styles, and the public module API.
- `scripts/constants.js` contains shared module constants, including `MODULE_VERSION`.
- `scripts/browser.js`, `scripts/styles.js`, and `scripts/settings.js` own the compendium browser UI.
- `scripts/exporter.js`, `scripts/importer.js`, and `scripts/link-checker.js` own GM-only data tools.
- `scripts/hooks.js` wires the browser into Foundry controls and compendium context menus.
- `scripts/utils.js` contains shared compatibility and data helpers.
- `release.ps1` builds `dist/v<version>/module.json` and the module zip, and can publish a GitHub release with `-Publish`.

## Development Conventions

- Use plain browser-compatible JavaScript ES modules.
- Keep two-space indentation and semicolons.
- Prefer existing helpers in `scripts/utils.js` before adding new utility code.
- Keep feature detection defensive across Foundry versions; avoid assuming one Foundry data shape when v12-v14 differ.
- Keep player-facing browser behavior available to all users, and keep import/export or world-mutating operations GM-only.
- Use `MODULE_ID`, `MODULE_VERSION`, and `EXPORT_SCHEMA` from `scripts/constants.js` instead of repeating literals.
- Preserve existing import/export behavior around folder IDs, document IDs, same-pack UUID rewrites, batching, and confirmation dialogs.
- Do not introduce npm dependencies or a build system unless the user explicitly asks for that larger change.

## Validation

There is no local automated test suite in the repo. Useful checks before finishing a change:

```powershell
git diff --check
.\release.ps1
```

Use `.\release.ps1` when manifest, version, packaging, or release asset behavior changes. The generated `dist/` directory is ignored and should not be committed.

For behavioral Foundry changes, manually smoke-test in Foundry when possible:

- Browser opens from scene controls and compendium context menus.
- Players can browse visible packs.
- GM-only import/export controls remain hidden or guarded for non-GMs.
- Pack, internal folder, directory folder, and broken-link workflows still work on supported Foundry versions.

## Versioning And Releases

When preparing a release:

- Update `version` and `download` in `module.json`.
- Update `MODULE_VERSION` in `scripts/constants.js`.
- Add user-facing notes to `CHANGELOG.md`.
- Run `.\release.ps1` to build local assets.
- Only run `.\release.ps1 -Publish` when the user explicitly asks to publish.

## Agent Hygiene

- Do not edit generated `dist/` assets unless specifically requested.
- Do not commit, tag, push, or publish unless the user asks.
- Keep changes scoped to the requested behavior.
- If the working tree has user changes, preserve them and work around them rather than reverting them.

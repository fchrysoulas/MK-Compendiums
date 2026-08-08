# Changelog

## 1.4.2

- Simplified compendium pack rows to display only the pack title, removing the document type, package name, and locked-status metadata.

## 1.4.1

- Filtered player-facing browser packs through Foundry's current-user compendium visibility state so hidden packs are no longer exposed by the custom browser.
- Reworked browser indexing to use lightweight indexes for browsing and document-type-specific deep fields only when description/text search is needed.
- Added bounded parallel pack indexing and explicit reporting when a pack falls back to a basic index.
- Reworked broken-link checks to request focused link-audit index fields and report degraded/basic-index scans instead of silently treating them as complete.
- Added Foundry data-model preflight validation before compendium import writes begin.
- Stopped silently unlocking locked compendiums. Imports now require explicit unlock confirmation and restore the original lock afterward.
- Added warnings before modifying system/module-owned compendium packs.
- Hardened Replace mode with an automatic downloadable recovery JSON before deletion and an automatic rollback attempt if the restore fails.
- Made folder-import failure fatal during Replace mode so a failed folder restore triggers rollback instead of continuing with folderless documents.
- Added shared multi-pack reference planning so directory-folder imports can rewrite cross-pack `Compendium.*` references when target pack or root document IDs change.
- Changed Compendium Directory folder pack discovery to prefer Foundry collection/folder data, with DOM inspection retained only as a compatibility fallback.
- Migrated import/export and broken-link fix dialogs to DialogV2 with a legacy fallback.
- Moved browser styling from injected JavaScript into a normal module stylesheet.
- Removed the duplicated hardcoded module version from runtime constants; runtime metadata now reads the installed version from Foundry's module registry.
- Removed the stale README reference to the removed Refresh button and documented the new safety behavior.

## 1.4.0

- Added a results-view combobox for switching normal compendium search results between list and icon-grid layouts.
- Added consistently sized square thumbnails, minimum-height icon cards, and a permanently available results scrollbar.
- Removed the browser layout and color settings in favor of a consistent fixed design.
- Restyled the compendium browser to match MK-Scene-Gallery's dark-glass surfaces, warm gold accents, controls, navigation rows, and result cards.
- Reworked the browser toolbar with compact Document, Entry Type, and Package filters, an expanding search field, and right-aligned actions.
- Removed the redundant Pack and Refresh dropdown/button controls; pack and folder selection now live exclusively in the sidebar.
- Fixed filter resets, hidden pack constraints, entry-type options, and the transition from broken-link checks back to normal searches.
- Changed searches and broken-link checks to use raw compendium indexes so malformed system documents cannot interrupt browser results.
- Raised the minimum supported Foundry VTT version to v13; validation now targets v13 and v14 only.

## 1.3.1

- Added a GM-only browser action to check item data in matching Item and Actor compendiums, world Items, and world Actor inventories for broken compendium UUID links.
- Added richer broken-link result rows with item type, source/folder, source UUID, missing target, and assigned actor details when available.
- Ignored provenance metadata such as Scene Packer source IDs so imported-origin UUIDs are not treated as broken item relations.
- Kept the browser broken-link audit display-only, with result rows opening the source document for review.
- Exposed broken-link checking and lower-level fixing helpers through the module API.

## 1.3.0

- Added Foundry VTT v14 compatibility metadata while keeping support for v12 and v13.

## 1.2.0

- Hardened import reference rewriting so exact IDs and Foundry-style references are remapped without rewriting arbitrary prose.
- Escaped pack and folder names in import confirmation dialog HTML.
- Improved export, import, and settings dialog fallback handling.
- Made browser search tolerate individual pack indexing failures while keeping results from other packs.
- Removed obsolete legacy export schema constants from the module API.

## 1.1.27

- Converted the MK Compendium Browser to extend Foundry `ApplicationV2` directly in both v12 and v13.
- Removed the legacy `Application` / `defaultOptions` / `_renderInner` browser path.
- Browser rendering now always uses the ApplicationV2 `{ force: true }` render call.

## 1.1.26

- Added the module version to the MK Compendium Browser window title.
- Updated the browser title in the shared ApplicationV2 browser path.

## 1.1.25

- Fixed duplicate browser event listeners that could open multiple export confirmation dialogs after re-rendering or searching in Foundry v13.
- Added a single-action guard for pack import/export buttons so repeated clicks or duplicated events cannot spawn duplicate dialogs.
- Hardened export confirmation so the same dialog cannot resolve more than once.

## 1.1.24

- Fixed Foundry v13 ApplicationV2 rendering when the render target is a wrapper instead of a direct DOM element.
- Removed import/export buttons from internal compendium folder rows in the browser tree; import/export buttons are now shown only on compendium pack rows.
- Added a confirmation step before pack imports and compendium directory-folder imports after the JSON file and mode are selected.
- Updated exported metadata version to 1.1.24.

## 1.1.23

- Fixed tree view label alignment so pack and folder text stays left-aligned instead of centered by Foundry button styles.

## 1.1.22

- Fixed the Foundry v13 ApplicationV2 crash when opening the MK Compendium Browser by storing mutable UI data in `browserState` instead of writing to ApplicationV2's read-only `state` getter.
- Kept the same package compatible with Foundry v12.

## 1.1.21

- Added ApplicationV2-compatible render methods for Foundry v13 while preserving the legacy ApplicationV1 path used by Foundry v12.
- Updated the browser launcher render call to use the v13 `{ force: true }` render style when running on Foundry v13.
- Kept the left toolbar MK Compendium Browser button visible to players.
- Kept import/export controls visible only to GMs inside the browser.

## 1.1.19

- Browser searches now include description text from full compendium documents, not only index fields such as name, type, pack, and folder.
- The Refresh button clears both the index cache and the description-search cache before repopulating the browser.

## 1.1.18

- Replaced the Clear button with a Refresh button.
- Refresh clears all browser filters, clears the browser index cache, and reloads compendium indexes before repopulating results.
- Preserved the left compendium tree scroll position when selecting folders inside a pack.

## 1.1.17

- Increased the default pack/folder row line height and minimum row height.
- Changed the default selected-row colors to a lighter blue palette.
- Added a small migration that updates worlds still using the old dark/compact defaults while preserving customized values.

## 1.1.16

- Removed the separate Browser UI Settings submenu/button.
- Browser UI sliders and color pickers now appear directly under Configure Settings -> Module Settings -> MK-Compendiums.
- Kept the settings world-scoped, restricted to GMs, and reload-confirmed after saving.

## 1.1.15

- Fixed Browser UI Settings form submission so values save through Foundry world settings instead of leaking into the browser URL query string.
- Added reload confirmation after saving or resetting the custom settings form.

## 1.1.14

- Fixed Browser UI Settings persistence after restart by reading submitted slider/color values safely across Foundry v12 and v13 form data shapes.
- Added a reload confirmation after saving Browser UI Settings.
- Added reload metadata to the registered world settings.

## 1.1.13

- Browser UI settings are now world-scoped so they sync to all users.
- The Browser UI Settings menu is GM-only.
- Fixed the settings window layout so the controls start at the top instead of showing a large blank gap.

## 1.1.12

- Folder icons inside the MK Compendium Browser now use each Foundry folder's saved color.
- Added a dedicated Browser UI Settings menu with sliders and color pickers.
- Browser UI settings are applied through CSS variables.

## 1.1.11

- Added module settings for MK Compendium Browser layout and colors.
- Settings include pack/folder row line height, row minimum height, selected background, selected hover background, selected accent color, icon size, icon font size, sidebar width, result image size, and folder indentation.

## 1.1.10

- Fixed the MK Compendium Browser render crash caused by `packHasDocumentExportApi` not being available inside `utils.js` after the script split.

## 1.1.9

- Split the monolithic script into focused files.
- Moved browser row density and selected-row colors into parameters in `scripts/constants.js`.
- Reverted the results-pane scrolling CSS to the previous behavior from v1.1.7.

## 1.1.7

- Removed import/export actions from Foundry context menus, compendium window headers, opened compendium folder rows, and compendium sidebar folder rows.
- Import/export is now only exposed through the MK Compendium Browser.
- Added export confirmation dialogs in the browser.
- Added a View button for compendium packs in the browser and removed double-click-to-open for pack rows.
- Made browser row icons smaller and reduced compendium pack row height.

## 1.1.3

- Fixed a browser race condition where the results header could update but the results list stayed stuck on **Loading compendium indexes...**.
- Search rendering now waits until the index load finishes before refreshing the browser, and stale overlapping searches are ignored.

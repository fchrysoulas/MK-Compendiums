# Changelog

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

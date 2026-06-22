# MK-Compendiums

## 1.1.27

- Converted the MK Compendium Browser window to use `ApplicationV2` only on both Foundry v12 and v13.
- Removed the legacy `Application`/`defaultOptions`/`_renderInner` browser path.
- Browser rendering now always uses the ApplicationV2 `{ force: true }` render call.

## 1.1.25

- Fixed duplicate browser event listeners that could open multiple export confirmation dialogs after re-rendering/searching in Foundry v13.
- Added a single-action guard for pack import/export buttons so repeated clicks or duplicated events cannot spawn duplicate dialogs.
- Export confirmation now settles only once, even if Foundry fires both button and close callbacks.

## 1.1.23

- Fixed tree view label alignment so pack and folder text stays left-aligned instead of centered by Foundry button styles.


Version 1.1.22 fixes the Foundry v13 ApplicationV2 reserved `state` crash while keeping the same package compatible with v12.

A small, system-agnostic Foundry VTT module that lets all users browse and search visible compendium packs, while GMs can export and import compendium packs or selected compendium folders as JSON.

## Compatibility

- Foundry VTT v12
- Foundry VTT v13

The module uses shared v12/v13 compendium and document database APIs, so a single version is provided. The Foundry module ID is `mk-compendiums`.

## Features

- Open **MK Compendium Browser** from the left scene controls toolbar.
- Search across compendium entries by name, description text, pack, folder, document type, entry type, and package.
- Browse packs, internal compendium folders as a tree under the selected pack, and result entries in one window.
- Internal compendium folder icons use the same color as the folder color stored in Foundry.
- Open entries directly from browser results with double-click. Use the View button on a pack row to open the compendium pack.
- Drag browser result rows using compendium UUID drag data.
- Use export/import buttons only inside the MK Compendium Browser.
- Browser import/export buttons appear only on compendium pack rows.
- Export/import a specific pack from the browser UI. Folder-level and Compendium Directory folder workflows remain available through the module API/backward-compatible functions.
- Folder export inside a pack includes the selected folder, all descendant folders, and all documents assigned to those folders.
- Compendium Directory folder export includes every exportable pack under the selected sidebar folder, including each pack's documents and internal compendium folders.
- Folder-level import into a pack places imported root folders under the selected target folder. Folderless documents are also placed in the target folder.
- Compendium Directory folder import matches exported packs to existing packs under the selected sidebar folder. If enabled, it creates missing packs as world compendiums inside that folder.
- Browser button is visible to players and GMs.
- Import/export tools remain GM-only.

## Browser UI Settings

Go to:

```text
Configure Settings -> Module Settings -> MK-Compendiums
```

The browser UI controls now appear directly in the normal module settings list. They include sliders for row height, icon size, sidebar width, thumbnail size, and folder indentation, plus color pickers for the selected row background, selected row hover background, and selected row accent color. These are world settings, so the layout and colors sync to all users. After saving, the module asks whether to reload the current Foundry client so the shared layout is fully refreshed.

## Export Data

Exports include:

- Foundry/system/world metadata
- Explicit MK-Compendiums export version metadata
- Target pack metadata
- Export scope metadata: whole pack or folder subset
- Compendium folder data when available
- Full document source data

## Import Behavior

Import preserves same-pack document references when possible, including references stored inside `system` data, flags, UUID strings, and object keys.

Import modes:

- **Upsert** - create new entries and update matching IDs
- **Add only** - skip entries whose IDs already exist
- **Create as new** - ignore exported IDs and create duplicates as new documents
- **Replace pack** - delete existing target entries first, then import

## Install

Unzip this folder into:

```text
FoundryVTT/Data/modules/mk-compendiums/
```

Then restart Foundry and enable **MK-Compendiums** in your world.

## Macro API

```js
game.modules.get("mk-compendiums").api.openCompendiumBrowser();

game.modules.get("mk-compendiums").api.exportPackToJson("world.your-pack-name");

// Export a folder inside a compendium pack.
game.modules.get("mk-compendiums").api.exportPackFolderToJson("world.your-pack-name", "folderIdHere");

// Export a Compendium Directory sidebar folder. Pass the folder HTML element from the browser/context workflow.
game.modules.get("mk-compendiums").api.exportCompendiumDirectoryFolderToJson(folderHtmlElement);

// Import a multi-pack Compendium Directory folder export into matching packs under a sidebar folder.
await game.modules.get("mk-compendiums").api.importCompendiumDirectoryFolderFromPayload(folderHtmlElement, payload, {
  mode: "upsert",
  preserveFolders: true,
  createMissingPacks: true
});
```

```js
game.modules.get("mk-compendiums").api.openImportDialog("world.your-pack-name");

// Open import dialog targeting a folder inside a compendium pack.
game.modules.get("mk-compendiums").api.openImportDialog("world.your-pack-name", {
  targetFolderId: "folderIdHere"
});
```

For advanced workflows, you can pass parsed JSON or a JSON string directly:

```js
await game.modules.get("mk-compendiums").api.importPackFromPayload("world.your-pack-name", payload, {
  mode: "upsert",
  preserveFolders: true,
  allowTypeMismatch: false
});
```

## Version Notes

### v1.1.27

- Converted the MK Compendium Browser to extend Foundry `ApplicationV2` directly in both v12 and v13.
- Removed the legacy ApplicationV1 browser class path.
- Browser opening now always uses the ApplicationV2 render signature.



### v1.1.26

- Added the module version to the MK Compendium Browser window title.
- Updated the browser title in the shared ApplicationV2 browser path.

### v1.1.25

- Fixed repeated listener binding in the browser after ApplicationV2 re-renders, which could open multiple export confirmation dialogs from one click.
- Added a busy-action guard around pack import/export actions.
- Hardened export confirmation so the same dialog cannot resolve more than once.

### v1.1.22

- Fixed the Foundry v13 ApplicationV2 crash when opening the MK Compendium Browser: the browser now stores its mutable UI data in `browserState` instead of writing to ApplicationV2's read-only `state` getter.
- The legacy v12 Application path was replaced later in v1.1.27 by the shared ApplicationV2 path.

### v1.1.21

- Added ApplicationV2-compatible render methods for Foundry v13 while preserving the legacy ApplicationV1 path used by Foundry v12. The browser was later converted fully to ApplicationV2 in v1.1.27.
- Updated the browser launcher render call to use the v13 `{ force: true }` render style when running on Foundry v13.
- Kept the left toolbar MK Compendium Browser button visible to players.
- Import/export controls remain visible only to GMs inside the browser.

### v1.1.19

- Browser searches now include description text from full compendium documents, not only index fields such as name, type, pack, and folder.
- The Refresh button clears both the index cache and the description-search cache before repopulating the browser.

### v1.1.18

- Replaced the Clear button with a Refresh button. Refresh clears all browser filters, clears the browser index cache, and reloads compendium indexes before repopulating results.
- Preserved the left compendium tree scroll position when selecting folders inside a pack.

### v1.1.17

- Increased the default pack/folder row line height and minimum row height.
- Changed the default selected-row colors to a lighter blue palette.
- Added a small migration that updates worlds still using the old dark/compact defaults while preserving customized values.

### v1.1.16

- Removed the separate Browser UI Settings submenu/button.
- Browser UI sliders and color pickers now appear directly under Configure Settings -> Module Settings -> MK-Compendiums.
- Kept the settings world-scoped, restricted to GMs, and reload-confirmed after saving.

### v1.1.15

- Fixed Browser UI Settings form submission so values save through Foundry world settings instead of leaking into the browser URL query string.
- Added reload confirmation after saving or resetting the custom settings form.

### v1.1.14

- Fixed Browser UI Settings persistence after restart by reading submitted slider/color values safely across Foundry v12 and v13 form data shapes.
- Added a reload confirmation after saving Browser UI Settings.
- Added reload metadata to the registered world settings.

### v1.1.13

- Browser UI settings are now world-scoped so they sync to all users.
- The Browser UI Settings menu is GM-only.
- Fixed the settings window layout so the controls start at the top instead of showing a large blank gap.

### v1.1.12

- Folder icons inside the MK Compendium Browser now use each Foundry folder's saved color.
- Added a dedicated Browser UI Settings menu with sliders and color pickers.
- Browser UI settings are applied through CSS variables.

### v1.1.11

- Added module settings for MK Compendium Browser layout and colors.
- Settings include pack/folder row line height, row minimum height, selected background, selected hover background, selected accent color, icon size, icon font size, sidebar width, result image size, and folder indentation.

### v1.1.10

- Fixed the MK Compendium Browser render crash caused by `packHasDocumentExportApi` not being available inside `utils.js` after the script split.

### v1.1.9

- Split the monolithic script into focused files.
- Moved browser row density and selected-row colors into parameters in `scripts/constants.js`.
- Reverted the results-pane scrolling CSS to the previous behavior from v1.1.7.

### v1.1.7

- Removed import/export actions from Foundry context menus, compendium window headers, opened compendium folder rows, and compendium sidebar folder rows. Import/export is now only exposed through the MK Compendium Browser.
- Added export confirmation dialogs in the browser.
- Added a View button for compendium packs in the browser and removed double-click-to-open for pack rows.
- Made browser row icons smaller and reduced compendium pack row height.

### v1.1.3

- Fixed a browser race condition where the results header could update but the results list stayed stuck on **Loading compendium indexes...**.
- Search rendering now waits until the index load finishes before refreshing the browser, and stale overlapping searches are ignored.

## Notes

- Importing into a locked pack requires the pack to be unlocked. The module tries to unlock it, but some packs may need to be unlocked manually.
- Importing system-specific documents into a different system may fail if the target system cannot validate the data.
- Same-pack references require the related documents to be present in the same imported JSON. For folder exports, references are remapped only if the referenced document is inside the exported folder subset. References outside the exported folder are left unchanged.
- Compendium Directory folder exports are multi-pack JSON exports. Folder-level import can restore them into matching packs under a selected Compendium Directory sidebar folder and can create missing packs as world compendiums.
- Folder preservation requires the export JSON to contain the `folders` array. Old exports that did not include folders can still import documents, but cannot recreate missing folder names.
- New exports include top-level `exportedWith`, `exportedVersion`, `exportedAt`, and `exportScope` fields, plus the same version/timestamp inside `exporter` for backward readability.
- **Replace pack** is destructive. Export a backup first.



## v1.1.24

- Fixed Foundry v13 ApplicationV2 rendering when the render target is a wrapper instead of a direct DOM element.
- Removed import/export buttons from internal compendium folder rows in the browser tree; import/export buttons are now shown only on compendium pack rows.
- Added a confirmation step before pack imports and compendium directory-folder imports after the JSON file and mode are selected.
- Updated exported metadata version to 1.1.24.

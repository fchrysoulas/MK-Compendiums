# MK-Compendiums

A small, system-agnostic Foundry VTT module for browsing, searching, exporting, and importing compendium content.

## Features

- Supports Foundry VTT v12, v13, and v14 with one module package.
- Opens the **MK Compendium Browser** from the left scene controls toolbar.
- Makes the browser available to players and GMs.
- Keeps import/export tools GM-only.
- Lets users browse visible compendium packs and internal compendium folders in one window.
- Shows internal compendium folders as a tree under the selected pack.
- Uses each Foundry folder's saved color for internal compendium folder icons.
- Searches compendium entries by name, description text, pack, folder, document type, entry type, and package.
- Filters browser results by document type, entry type, package, and pack.
- Opens compendium entries directly from browser results with double-click.
- Opens a compendium pack from the browser with the View button.
- Checks matching Item compendiums for broken compendium UUID links from the browser.
- Lets GMs replace or clear compendium UUID links found inside Item data when the target does not exist in a compendium.
- Supports dragging browser result rows with compendium UUID drag data.
- Preserves the browser sidebar scroll position while selecting folders inside a pack.
- Provides a Refresh button that clears filters, clears index caches, and reloads compendium indexes.
- Shows the module version in the MK Compendium Browser window title.

## Browser UI Settings

The browser UI settings appear in:

```text
Configure Settings -> Module Settings -> MK-Compendiums
```

The module includes world-scoped settings for:

- Pack and folder row height.
- Browser icon size.
- Sidebar width.
- Result thumbnail size.
- Folder indentation.
- Selected row background color.
- Selected row hover background color.
- Selected row accent color.

After saving browser UI settings, the module asks whether to reload the current Foundry client so the shared layout is fully refreshed.

## Export Features

- Exports a specific compendium pack from the MK Compendium Browser.
- Exports selected folders inside a compendium pack through the module API and backward-compatible workflows.
- Exports Compendium Directory sidebar folders through the module API and backward-compatible workflows.
- Includes the selected folder, all descendant folders, and all documents assigned to those folders when exporting a folder inside a pack.
- Includes every exportable pack under the selected sidebar folder when exporting a Compendium Directory folder.
- Includes internal compendium folder data when available.
- Includes full document source data.
- Includes Foundry, system, world, pack, export scope, timestamp, and MK-Compendiums export version metadata.
- Confirms browser export actions before writing JSON.

## Import Features

- Imports JSON into a specific compendium pack from the MK Compendium Browser.
- Imports folder exports into a target folder inside a compendium pack through the module API and backward-compatible workflows.
- Imports Compendium Directory folder exports into matching packs under a selected sidebar folder through the module API and backward-compatible workflows.
- Can create missing packs as world compendiums when importing Compendium Directory folder exports.
- Preserves exported folder structure when possible.
- Places imported root folders under the selected target folder during folder-level imports.
- Places folderless documents in the selected target folder during folder-level imports.
- Preserves same-pack document references when possible, including references stored inside `system` data, flags, UUID strings, and object keys.
- Confirms imports after the JSON file and import mode are selected.
- Guards browser import/export actions so repeated clicks cannot open duplicate dialogs.

Import modes:

- **Upsert** - create new entries and update matching IDs.
- **Add only** - skip entries whose IDs already exist.
- **Create as new** - ignore exported IDs and create duplicates as new documents.
- **Replace pack** - delete existing target entries first, then import.

## Macro API

```js
game.modules.get("mk-compendiums").api.openCompendiumBrowser();

game.modules.get("mk-compendiums").api.exportPackToJson("world.your-pack-name");

game.modules.get("mk-compendiums").api.exportPackFolderToJson("world.your-pack-name", "folderIdHere");

game.modules.get("mk-compendiums").api.exportCompendiumDirectoryFolderToJson(folderHtmlElement);

await game.modules.get("mk-compendiums").api.importCompendiumDirectoryFolderFromPayload(folderHtmlElement, payload, {
  mode: "upsert",
  preserveFolders: true,
  createMissingPacks: true
});
```

```js
game.modules.get("mk-compendiums").api.openImportDialog("world.your-pack-name");

game.modules.get("mk-compendiums").api.openImportDialog("world.your-pack-name", {
  targetFolderId: "folderIdHere"
});
```

```js
const pack = game.packs.get("world.your-pack-name");
const brokenLinks = await game.modules.get("mk-compendiums").api.findBrokenLinksInPacks([pack]);
```

```js
await game.modules.get("mk-compendiums").api.importPackFromPayload("world.your-pack-name", payload, {
  mode: "upsert",
  preserveFolders: true,
  allowTypeMismatch: false
});
```

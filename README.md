# MK-Compendiums

A system-agnostic Foundry VTT module for browsing, searching, exporting, importing, and auditing compendium content.

## Features

- Supports Foundry VTT v13 and v14.
- Opens the **MK Compendium Browser** from the left scene controls toolbar.
- Makes the browser available to players and GMs.
- Players only see compendium packs that Foundry marks as visible to their current user.
- Keeps import/export and link-audit tools GM-only.
- Lets users browse visible compendium packs and internal compendium folders in one window.
- Shows internal compendium folders as a tree under the selected pack.
- Uses each Foundry folder's saved color for internal compendium folder icons.
- Searches compendium entries by name, description text, pack, folder, document type, entry type, and package.
- Uses lightweight indexes for normal browsing and loads deeper, document-type-specific index fields only for text searches.
- Reports packs that fall back to a basic index so incomplete description matches are not silent.
- Filters browser results by document type, entry type, package, and pack.
- Opens compendium entries directly from browser results with double-click.
- Opens a compendium pack from the browser with the View button.
- Checks Item and Actor compendiums, world Items, and world Actor inventories for broken compendium UUID links.
- Reports when a link audit had to use a basic index and embedded-link results may be incomplete.
- Shows whether the broken item is standalone or assigned to an actor, including world actor assignments.
- Supports dragging browser result rows with compendium UUID drag data.
- Preserves the browser sidebar scroll position while selecting folders inside a pack.
- Shows the module version in the MK Compendium Browser window title.

## Browser Style

The browser uses a fixed dark-glass visual language with warm gold accents, glass surfaces, and elevated interactive rows. Browser CSS is loaded as a normal module stylesheet rather than being injected from JavaScript.

## Export Features

- Exports a specific compendium pack from the MK Compendium Browser.
- Exports selected folders inside a compendium pack through the module API.
- Exports Compendium Directory sidebar folders through the module API.
- Includes the selected folder, all descendant folders, and all documents assigned to those folders when exporting a folder inside a pack.
- Includes every exportable pack under the selected Compendium Directory folder, including descendant sidebar folders.
- Includes internal compendium folder data when available.
- Includes full document source data.
- Includes Foundry, system, world, pack, export scope, timestamp, and MK-Compendiums export version metadata.
- Confirms browser export actions before writing JSON.

## Import Safety

- Imports JSON into a specific compendium pack from the MK Compendium Browser.
- Imports folder exports into a target folder inside a compendium pack through the module API.
- Imports Compendium Directory folder exports into matching packs under a selected sidebar folder.
- Can create missing packs as world compendiums when importing Compendium Directory folder exports.
- Preflight-validates incoming folders and documents with Foundry's own data models before writes begin.
- Does **not** silently unlock locked packs. A locked pack requires explicit confirmation, is temporarily unlocked, and is re-locked after the import.
- Warns before modifying a compendium owned by a system or module because package updates can overwrite those changes.
- **Replace pack** creates and downloads a recovery JSON before deleting anything.
- If a Replace import fails after deletion begins, MK-Compendiums attempts to restore the automatic recovery snapshot.
- Preserves exported folder structure when possible.
- Places imported root folders and folderless documents under the selected target folder during folder-level imports.
- Preserves same-pack document references when possible, including references stored inside system data, flags, UUID strings, and object keys.
- Multi-pack directory imports build a shared reference plan so `Compendium.*` references can follow packs and root documents whose IDs change.
- Uses Foundry DialogV2 on supported versions, with a legacy fallback where necessary.
- Guards browser import/export actions so repeated clicks cannot spawn duplicate operations.

Import modes:

- **Upsert** - create new entries and update matching IDs.
- **Add only** - skip entries whose IDs already exist.
- **Create as new** - assign new root document IDs and create duplicates.
- **Replace pack** - validate first, save a recovery backup, delete existing content, restore from JSON, and roll back automatically if the restore fails.

## Macro API

```js
game.modules.get("mk-compendiums").api.openCompendiumBrowser();

game.modules.get("mk-compendiums").api.exportPackToJson("world.your-pack-name");

game.modules.get("mk-compendiums").api.exportPackFolderToJson(
  "world.your-pack-name",
  "folderIdHere"
);
```

```js
game.modules.get("mk-compendiums").api.openImportDialog("world.your-pack-name");

await game.modules.get("mk-compendiums").api.importPackFromPayload(
  "world.your-pack-name",
  payload,
  {
    mode: "upsert",
    preserveFolders: true,
    allowTypeMismatch: false
  }
);
```

```js
await game.modules.get("mk-compendiums").api.importCompendiumDirectoryFolderFromPayload(
  folderHtmlElement,
  payload,
  {
    mode: "upsert",
    preserveFolders: true,
    createMissingPacks: true
  }
);
```

```js
const pack = game.packs.get("world.your-pack-name");
const brokenLinks = await game.modules.get("mk-compendiums").api.findBrokenLinksInPacks([pack]);
const worldBrokenLinks = await game.modules.get("mk-compendiums").api.findBrokenLinksInWorld();
```

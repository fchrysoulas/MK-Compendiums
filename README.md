# MK-Compendiums

A system-agnostic Foundry VTT module for browsing, searching, exporting, importing, and auditing compendium content.

## Installation

### Foundry's module installer (recommended)

1. In Foundry, open **Setup** and select **Add-on Modules**.
2. Select **Install Module**.
3. Paste the following manifest URL and select **Install**:

   `https://github.com/fchrysoulas/MK-Compendiums/releases/latest/download/module.json`

4. In your world, open **Manage Modules**, enable **MK-Compendiums**, and save.

### Manual installation

1. Download the latest release from the [GitHub releases page](https://github.com/fchrysoulas/MK-Compendiums/releases/latest).
2. Extract `mk-compendiums.zip` into Foundry's `Data/modules` directory.
3. Restart Foundry, enable **MK-Compendiums** from **Manage Modules**, and save.

MK-Compendiums supports Foundry VTT v13 and v14.

## Features

- Browse visible compendium packs and their internal folder trees.
- Search and filter entries by name, text, pack, folder, document type, entry type, and package.
- Open entries, view packs, and drag results using Foundry's compendium UUID data.
- Export packs or folders, including folder structure, document data, and export metadata.
- Import into existing packs or Compendium Directory folders with **Upsert**, **Add only**, **Create as new**, and **Replace pack** modes.
- Audit Item and Actor compendiums, world Items, and world Actor inventories for broken compendium links.
- Keep browsing available to players while restricting import, export, and auditing tools to GMs.

Import operations validate data before writing, preserve folder structure and same-pack references where possible, and warn before changing packs owned by a system or module. Replace operations create a recovery JSON before deleting content and attempt an automatic rollback if restoration fails. Locked packs are only unlocked after explicit confirmation and are re-locked afterward.

Open the **MK Compendium Browser** from the left Scene Controls toolbar.

## Macro API

Open the browser or an import dialog:

```js
game.modules.get("mk-compendiums").api.openCompendiumBrowser();
game.modules.get("mk-compendiums").api.openImportDialog("world.your-pack-name");
```

Export a pack or one of its internal folders:

```js
game.modules.get("mk-compendiums").api.exportPackToJson("world.your-pack-name");

game.modules.get("mk-compendiums").api.exportPackFolderToJson(
  "world.your-pack-name",
  "folderIdHere"
);
```

Import a pack payload:

```js
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

Import a Compendium Directory folder payload:

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

Audit packs or world data for broken links:

```js
const pack = game.packs.get("world.your-pack-name");
const brokenLinks = await game.modules.get("mk-compendiums").api.findBrokenLinksInPacks([pack]);
const worldBrokenLinks = await game.modules.get("mk-compendiums").api.findBrokenLinksInWorld();
```

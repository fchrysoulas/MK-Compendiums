import { EXPORT_SCHEMA, MODULE_ID } from './constants.js';
import { registerCompendiumBrowserSceneControl, registerCompendiumContextMenu } from './hooks.js';
import { openCompendiumBrowser } from './browser.js';
import {
  exportCompendiumDirectoryFolderToJson,
  exportPackFolderToJson,
  exportPackToJson
} from './exporter.js';
import {
  createWorldCompendiumForExportBlock,
  importCompendiumDirectoryFolderFromPayload,
  importPackFromPayload,
  openCompendiumDirectoryFolderImportDialog,
  openImportDialog
} from './importer.js';
import {
  applyBrokenLinkFix,
  findBrokenLinksInPacks,
  findBrokenLinksInWorld,
  openBrokenLinkFixDialog
} from './link-checker.js';
import { log } from './utils.js';

Hooks.once("init", () => {
  log("Initializing");
  registerCompendiumContextMenu();
  registerCompendiumBrowserSceneControl();

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      EXPORT_SCHEMA,
      exportPackToJson,
      exportPackFolderToJson,
      exportCompendiumDirectoryFolderToJson,
      importPackFromPayload,
      importCompendiumDirectoryFolderFromPayload,
      createWorldCompendiumForExportBlock,
      openImportDialog,
      openCompendiumDirectoryFolderImportDialog,
      findBrokenLinksInPacks,
      findBrokenLinksInWorld,
      applyBrokenLinkFix,
      openBrokenLinkFixDialog,
      openCompendiumBrowser
    };
  }
});

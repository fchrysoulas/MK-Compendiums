import {
  EXPORT_SCHEMA,
  LEGACY_EXPORT_SCHEMA,
  MODULE_ID,
  OLDER_EXPORT_SCHEMA
} from './constants.js';
import { log } from './utils.js';
import { applyBrowserUiSettingsToDocument, migrateBrowserUiDefaultsIfNeeded, registerSettings } from './settings.js';
import { injectStyles } from './styles.js';
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

Hooks.once("init", () => {
  log("Initializing");
  registerSettings();
  injectStyles();
  applyBrowserUiSettingsToDocument();

  registerCompendiumContextMenu();
  registerCompendiumBrowserSceneControl();

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      EXPORT_SCHEMA,
      LEGACY_EXPORT_SCHEMA,
      OLDER_EXPORT_SCHEMA,
      exportPackToJson,
      exportPackFolderToJson,
      exportCompendiumDirectoryFolderToJson,
      importPackFromPayload,
      importCompendiumDirectoryFolderFromPayload,
      createWorldCompendiumForExportBlock,
      openImportDialog,
      openCompendiumDirectoryFolderImportDialog,
      openCompendiumBrowser,
      applyBrowserUiSettingsToDocument
    };
  }
});


Hooks.once("ready", () => {
  void migrateBrowserUiDefaultsIfNeeded();
});

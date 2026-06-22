import { MODULE_ID, MODULE_VERSION, EXPORT_SCHEMA } from './constants.js';
import {
  buildExporterMetadata,
  collectPackFolderTree,
  documentIdOf,
  error,
  escapeHtml,
  getDirectoryFolderDataFromElement,
  getDocumentFolderIdFromSource,
  getDocumentSource,
  getFolderName,
  getPackFoldersSource,
  getPackFoldersSubsetSource,
  getPackIdsFromDirectoryFolderElement,
  getPackMetadata,
  notifyInfo,
  resolveFolderInPack,
  resolvePack,
  slugifyFilePart,
  warn
} from './utils.js';

export function buildExportPayload(pack, entries, folders, { scope = "pack", rootFolder = null } = {}) {
  const exportedAt = new Date().toISOString();

  return {
    schema: EXPORT_SCHEMA,
    exportedWith: {
      moduleId: MODULE_ID,
      moduleTitle: "MK-Compendiums",
      moduleVersion: MODULE_VERSION
    },
    exportedVersion: MODULE_VERSION,
    exportedAt,
    exportScope: scope,
    exporter: buildExporterMetadata(exportedAt, scope),
    pack: getPackMetadata(pack, { rootFolder }),
    folders,
    count: entries.length,
    entries
  };
}

export function buildCompendiumDirectoryFolderExportPayload(folder, packs) {
  const exportedAt = new Date().toISOString();
  const folderId = documentIdOf(folder) ?? null;
  const folderName = getFolderName(folder);
  const documentCount = packs.reduce((total, packExport) => total + (packExport.count ?? 0), 0);
  const folderCount = packs.reduce((total, packExport) => total + (packExport.folders?.length ?? 0), 0);

  return {
    schema: EXPORT_SCHEMA,
    exportedWith: {
      moduleId: MODULE_ID,
      moduleTitle: "MK-Compendiums",
      moduleVersion: MODULE_VERSION
    },
    exportedVersion: MODULE_VERSION,
    exportedAt,
    exportScope: "compendium-directory-folder",
    exporter: buildExporterMetadata(exportedAt, "compendium-directory-folder"),
    compendiumFolder: {
      id: folderId,
      name: folderName,
      packCount: packs.length,
      documentCount,
      folderCount
    },
    packCount: packs.length,
    count: documentCount,
    folderCount,
    packs
  };
}

export function saveExportPayload(payload, pack, { folder = null } = {}) {
  const packId = pack.collection ?? pack.metadata?.id ?? pack.metadata?.name ?? "unknown-pack";
  const scopePart = folder ? `folder-${slugifyFilePart(getFolderName(folder))}` : "pack";
  const filename = `${slugifyFilePart(game.world?.id)}-${slugifyFilePart(packId)}-${scopePart}-mk-compendiums-v${MODULE_VERSION}.json`;

  saveDataToFile(JSON.stringify(payload, null, 2), "application/json", filename);
}

export function saveCompendiumDirectoryFolderExportPayload(payload, folder) {
  const folderName = getFolderName(folder);
  const filename = `${slugifyFilePart(game.world?.id)}-compendium-folder-${slugifyFilePart(folderName)}-mk-compendiums-v${MODULE_VERSION}.json`;

  saveDataToFile(JSON.stringify(payload, null, 2), "application/json", filename);
}

export function packHasDocumentExportApi(pack) {
  return !!pack && typeof pack.getDocuments === "function";
}

export async function getPackExportBlock(pack) {
  if (!packHasDocumentExportApi(pack)) return null;

  const documents = await pack.getDocuments();
  const entries = documents.map(getDocumentSource).filter(Boolean);
  const folders = getPackFoldersSource(pack);

  return {
    pack: getPackMetadata(pack),
    folders,
    count: entries.length,
    entries
  };
}

export async function confirmExportAction({ title = "Confirm Export", message = "Export this compendium data to JSON?" } = {}) {
  const DialogClass = globalThis.Dialog;
  if (!DialogClass) return window.confirm(message);

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    new DialogClass({
      title,
      content: `<p>${escapeHtml(message)}</p>`,
      buttons: {
        export: {
          icon: '<i class="fas fa-file-export"></i>',
          label: "Export",
          callback: () => finish(true)
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => finish(false)
        }
      },
      default: "export",
      close: () => finish(false)
    }).render(true);
  });
}

export async function exportCompendiumDirectoryFolderToJson(element) {
  if (!game.user?.isGM) {
    warn("Only the GM can export compendium folders.");
    return null;
  }

  const folder = getDirectoryFolderDataFromElement(element);
  const folderName = getFolderName(folder);
  const packIds = getPackIdsFromDirectoryFolderElement(element);

  if (!packIds.length) {
    warn(`No compendium packs were found under folder "${folderName}".`);
    return null;
  }

  try {
    if (!await confirmExportAction({
      title: "Export Compendium Directory Folder",
      message: `Export compendium directory folder "${folderName}" with ${packIds.length} pack(s) to JSON?`
    })) return null;

    notifyInfo(`Exporting compendium folder "${folderName}" with ${packIds.length} pack(s).`);

    const packs = [];

    for (const packId of packIds) {
      const pack = resolvePack(packId);
      if (!packHasDocumentExportApi(pack)) {
        console.warn(`${MODULE_ID} v${MODULE_VERSION} | Skipping non-pack entry while exporting compendium folder`, packId, pack);
        continue;
      }

      const packExport = await getPackExportBlock(pack);
      if (packExport) packs.push(packExport);
    }

    if (!packs.length) {
      warn(`No exportable compendium packs were found under folder "${folderName}".`);
      return null;
    }

    const payload = buildCompendiumDirectoryFolderExportPayload(folder, packs);
    saveCompendiumDirectoryFolderExportPayload(payload, folder);
    notifyInfo(`Exported ${payload.count} documents from ${payload.packCount} pack(s) in compendium folder "${folderName}".`);

    return payload;
  } catch (err) {
    error(`Failed to export compendium folder: ${folderName}`, err);
    return null;
  }
}

export async function exportPackToJson(packIdOrPack) {
  const pack = resolvePack(packIdOrPack);

  if (!pack || !packHasDocumentExportApi(pack)) {
    warn("Compendium pack not found or not exportable.");
    return null;
  }

  if (!game.user?.isGM) {
    warn("Only the GM can export compendium packs.");
    return null;
  }

  try {
    const title = pack.title ?? pack.metadata?.label ?? pack.collection ?? "Compendium";

    notifyInfo(`Exporting compendium: ${title}`);

    const documents = await pack.getDocuments();
    const entries = documents.map(getDocumentSource).filter(Boolean);
    const folders = getPackFoldersSource(pack);
    const payload = buildExportPayload(pack, entries, folders, { scope: "pack" });

    saveExportPayload(payload, pack);
    notifyInfo(`Exported ${entries.length} documents and ${folders.length} folders from ${title}.`);

    return payload;
  } catch (err) {
    error(`Failed to export compendium: ${pack.title ?? pack.collection ?? "unknown"}`, err);
    return null;
  }
}

export async function exportPackFolderToJson(packIdOrPack, folderIdOrFolder) {
  const pack = resolvePack(packIdOrPack);

  if (!pack || !packHasDocumentExportApi(pack)) {
    warn("Compendium pack not found or not exportable.");
    return null;
  }

  if (!game.user?.isGM) {
    warn("Only the GM can export compendium folders.");
    return null;
  }

  const folder = resolveFolderInPack(pack, folderIdOrFolder);

  if (!folder) {
    warn("Compendium folder not found.");
    return null;
  }

  try {
    const folderId = documentIdOf(folder);
    const folderName = getFolderName(folder);
    const title = pack.title ?? pack.metadata?.label ?? pack.collection ?? "Compendium";

    notifyInfo(`Exporting folder "${folderName}" from ${title}.`);

    const folderIds = collectPackFolderTree(pack, folderId);
    const documents = await pack.getDocuments();
    const entries = documents
      .map(getDocumentSource)
      .filter(Boolean)
      .filter(entry => folderIds.has(getDocumentFolderIdFromSource(entry)));
    const folders = getPackFoldersSubsetSource(pack, folderIds);

    const payload = buildExportPayload(pack, entries, folders, {
      scope: "folder",
      rootFolder: {
        id: folderId,
        name: folderName,
        folderCount: folders.length,
        documentCount: entries.length
      }
    });

    saveExportPayload(payload, pack, { folder });
    notifyInfo(`Exported ${entries.length} documents and ${folders.length} folders from "${folderName}".`);

    return payload;
  } catch (err) {
    error(`Failed to export compendium folder: ${getFolderName(folder)}`, err);
    return null;
  }
}

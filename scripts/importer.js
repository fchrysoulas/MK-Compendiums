import { MODULE_ID, getModuleVersion } from './constants.js';
import { confirmDialog, waitFormDialog } from './dialogs.js';
import { buildExportPayload, saveExportPayload } from './exporter.js';
import {
  buildDocumentIdMap,
  cleanDocumentData,
  cleanFolderData,
  deepClone,
  documentIdOf,
  error,
  escapeHtml,
  findTargetPackForExportBlock,
  getAvailableWorldPackName,
  getCompendiumCollectionClass,
  getDirectoryFolderDataFromElement,
  getDocumentClassForPack,
  getDocumentSource,
  getFolderDocumentClass,
  getFolderName,
  getPackCreateOptions,
  getPackFolderIds,
  getPackFoldersSource,
  getPackIdsFromDirectoryFolderElement,
  getPackIndexIds,
  getPackPackageName,
  normalizeFolderReference,
  normalizeImportPayload,
  normalizeDirectoryImportPayload,
  notifyInfo,
  resolveFolderInPack,
  resolvePack,
  rewriteCompendiumReferences,
  rewriteDocumentReferences,
  runBatched,
  warn
} from './utils.js';

function getPackPackageType(pack) {
  const explicit = String(pack?.metadata?.packageType ?? "").toLowerCase();
  if (explicit) return explicit;
  const packageName = getPackPackageName(pack);
  return packageName === "world" ? "world" : "package";
}

function isWorldPack(pack) {
  return getPackPackageType(pack) === "world" || getPackPackageName(pack) === "world";
}

async function beginPackWriteSession(pack, { packageWriteConfirmed = false, unlockConfirmed = false } = {}) {
  const packageOwned = !isWorldPack(pack);
  const packageName = getPackPackageName(pack);

  if (packageOwned && !packageWriteConfirmed) {
    const approved = await confirmDialog({
      title: "Modify Package Compendium?",
      content: `
        <p><strong>${escapeHtml(pack.title ?? pack.collection)}</strong> belongs to package <strong>${escapeHtml(packageName)}</strong>, not to this world.</p>
        <p>Changes to system or module compendiums can be overwritten when that package updates.</p>
        <p>Continue with this import?</p>
      `,
      yesLabel: "Continue",
      noLabel: "Cancel",
      yesIcon: "fa-solid fa-triangle-exclamation",
      defaultYes: false
    });
    if (!approved) return null;
  }

  const session = {
    originalLocked: !!pack.locked,
    unlockedByModule: false
  };

  if (pack.locked) {
    if (!unlockConfirmed) {
      const approved = await confirmDialog({
        title: "Temporarily Unlock Compendium?",
        content: `
          <p><strong>${escapeHtml(pack.title ?? pack.collection)}</strong> is locked.</p>
          <p>MK-Compendiums can temporarily unlock it for this import and restore the lock afterward.</p>
        `,
        yesLabel: "Unlock & Import",
        noLabel: "Cancel",
        yesIcon: "fa-solid fa-lock-open",
        defaultYes: false
      });
      if (!approved) return null;
    }

    if (typeof pack.configure !== "function") {
      warn(`The compendium "${pack.title}" is locked and cannot be unlocked by this Foundry version.`);
      return null;
    }

    try {
      await pack.configure({ locked: false });
    } catch (err) {
      console.warn(`${MODULE_ID} v${getModuleVersion()} | Could not unlock compendium`, err);
    }

    if (pack.locked) {
      warn(`The compendium "${pack.title}" could not be unlocked. Import cancelled.`);
      return null;
    }

    session.unlockedByModule = true;
  }

  return session;
}

async function restorePackWriteSession(pack, session) {
  if (!session?.originalLocked || !session.unlockedByModule || pack?.locked || typeof pack?.configure !== "function") return;
  try {
    await pack.configure({ locked: true });
  } catch (err) {
    console.warn(`${MODULE_ID} v${getModuleVersion()} | Could not restore compendium lock`, err);
    warn(`Import finished, but MK-Compendiums could not re-lock "${pack.title}". Re-lock it manually.`);
  }
}

export async function deleteExistingPackDocuments(pack, documentClass) {
  const existingIds = Array.from(await getPackIndexIds(pack));
  if (!existingIds.length) return [];
  return runBatched(existingIds, batch => documentClass.deleteDocuments(batch, { pack: pack.collection }));
}

export async function deleteExistingPackFolders(pack) {
  const folderClass = getFolderDocumentClass();
  if (!folderClass?.deleteDocuments) return [];

  const existingFolderIds = Array.from(getPackFolderIds(pack));
  if (!existingFolderIds.length) return [];
  return runBatched(existingFolderIds, batch => folderClass.deleteDocuments(batch, { pack: pack.collection }));
}

export function prepareFolderQueue(folders, pack, { preserveIds = true } = {}) {
  const byOldId = new Map();
  const withoutIds = [];

  for (const folder of folders ?? []) {
    const oldId = documentIdOf(folder);
    const data = cleanFolderData(folder, pack, { preserveIds });
    const parentOldId = normalizeFolderReference(folder?.folder ?? data.folder);
    const prepared = { oldId, parentOldId, data };

    if (oldId) byOldId.set(oldId, prepared);
    else withoutIds.push(prepared);
  }

  const ordered = [];
  const pending = new Map(byOldId);
  const resolved = new Set();

  while (pending.size) {
    let moved = false;

    for (const [oldId, prepared] of Array.from(pending.entries())) {
      if (!prepared.parentOldId || !pending.has(prepared.parentOldId) || resolved.has(prepared.parentOldId)) {
        ordered.push(prepared);
        resolved.add(oldId);
        pending.delete(oldId);
        moved = true;
      }
    }

    if (!moved) {
      for (const [oldId, prepared] of Array.from(pending.entries())) {
        prepared.parentOldId = null;
        prepared.data.folder = null;
        ordered.push(prepared);
        resolved.add(oldId);
        pending.delete(oldId);
      }
    }
  }

  return [...ordered, ...withoutIds];
}

export async function importFoldersToPack(pack, folders, { mode = "upsert", preserveIds = true, targetFolderId = null } = {}) {
  const idMap = new Map();
  const targetId = normalizeFolderReference(targetFolderId);

  if (!folders?.length) return { created: 0, updated: 0, deleted: 0, skipped: 0, idMap };

  const folderClass = getFolderDocumentClass();
  if (!folderClass?.createDocuments) throw new Error("Folder document class is not available.");

  const existingIds = getPackFolderIds(pack);
  const importedFolderIds = new Set(folders.map(folder => documentIdOf(folder)).filter(Boolean));
  const preparedFolders = prepareFolderQueue(folders, pack, { preserveIds });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const prepared of preparedFolders) {
    const { oldId, parentOldId } = prepared;
    const data = deepClone(prepared.data);

    if (parentOldId) {
      const mappedParentId = idMap.get(parentOldId);
      if (mappedParentId) data.folder = mappedParentId;
      else if (targetId && !importedFolderIds.has(parentOldId)) data.folder = targetId;
      else data.folder = existingIds.has(parentOldId) ? parentOldId : (targetId ?? null);
    } else {
      data.folder = targetId ?? null;
    }

    if (oldId && preserveIds && existingIds.has(oldId)) {
      data._id = oldId;
      idMap.set(oldId, oldId);

      if (mode === "add") {
        skipped += 1;
        continue;
      }

      const result = await folderClass.updateDocuments([data], { pack: pack.collection });
      updated += result?.length ?? 0;
      continue;
    }

    if (!preserveIds) delete data._id;

    const result = await folderClass.createDocuments([data], getPackCreateOptions(pack, { keepId: preserveIds }));
    const createdFolder = result?.[0] ?? null;
    if (createdFolder) {
      created += 1;
      if (oldId) idMap.set(oldId, createdFolder.id ?? createdFolder._id ?? data._id ?? oldId);
    }
  }

  return { created, updated, deleted: 0, skipped, idMap };
}

export function rewriteEntryFolderReference(entry, folderIdMap, { preserveFolders = true, targetFolderId = null } = {}) {
  const data = deepClone(entry);
  const targetId = normalizeFolderReference(targetFolderId);

  if (!preserveFolders) {
    data.folder = targetId ?? null;
    return data;
  }

  const oldFolderId = normalizeFolderReference(data.folder);
  if (!oldFolderId) {
    data.folder = targetId ?? null;
    return data;
  }

  data.folder = folderIdMap.get(oldFolderId) ?? (targetId ?? oldFolderId);
  return data;
}

function prepareEntrySources(rawEntries, {
  preserveIds,
  preserveFolders,
  targetFolderId,
  documentIdMap,
  folderIdMap = new Map(),
  referencePlan = []
} = {}) {
  return (rawEntries ?? []).map(entry => {
    const oldDocumentId = documentIdOf(entry);
    const mappedDocumentId = oldDocumentId ? documentIdMap.get(oldDocumentId) : null;
    const cleaned = cleanDocumentData(entry, { preserveIds, preserveFolders });

    if (mappedDocumentId) cleaned._id = mappedDocumentId;

    const withFolder = rewriteEntryFolderReference(cleaned, folderIdMap, { preserveFolders, targetFolderId });
    // Rewrite fully-qualified compendium references first so an ID collision in a
    // different pack cannot be mistaken for a same-pack document reference.
    const withGlobalCompendiumReferences = rewriteCompendiumReferences(withFolder, referencePlan);
    return rewriteDocumentReferences(withGlobalCompendiumReferences, documentIdMap);
  });
}

function preflightModelSource(modelClass, source, context, label) {
  if (!modelClass || !source) return;

  try {
    if (typeof modelClass.fromSource === "function") {
      const model = modelClass.fromSource(deepClone(source), { ...context, strict: true });
      model?.validate?.({ strict: true });
      return;
    }

    const model = new modelClass(deepClone(source), context);
    model?.validate?.({ strict: true });
  } catch (err) {
    throw new Error(`${label} failed Foundry data validation: ${err?.message ?? err}`, { cause: err });
  }
}

function preflightImportSources(pack, documentClass, entries, folders, { preserveFolderIds = true } = {}) {
  const context = { pack: pack.collection };
  const folderClass = getFolderDocumentClass();

  for (const folder of folders ?? []) {
    const source = cleanFolderData(folder, pack, { preserveIds: preserveFolderIds });
    preflightModelSource(folderClass, source, context, `Folder "${getFolderName(folder)}"`);
  }

  for (const entry of entries ?? []) {
    const label = entry?.name ?? documentIdOf(entry) ?? "Unnamed document";
    preflightModelSource(documentClass, entry, context, `Document "${label}"`);
  }
}

async function capturePackRecoverySnapshot(pack) {
  const documents = await pack.getDocuments();
  const entries = documents.map(getDocumentSource).filter(Boolean);
  const folders = getPackFoldersSource(pack);
  const payload = buildExportPayload(pack, entries, folders, { scope: "pre-replace-recovery" });
  const filename = saveExportPayload(payload, pack, { prefix: "pre-replace-recovery" });
  return { entries, folders, payload, filename };
}

function cleanRecoveryDocumentData(input) {
  const data = deepClone(input);
  delete data._key;
  delete data.pack;
  delete data.compendium;
  delete data.uuid;
  if (!data._id && data.id) data._id = data.id;
  delete data.id;
  data.folder = normalizeFolderReference(data.folder);
  return data;
}

async function restorePackRecoverySnapshot(pack, snapshot, documentClass) {
  if (!snapshot) return false;

  try {
    await deleteExistingPackDocuments(pack, documentClass);
    await deleteExistingPackFolders(pack);

    if (snapshot.folders?.length) {
      await importFoldersToPack(pack, snapshot.folders, { mode: "upsert", preserveIds: true });
    }

    const entries = (snapshot.entries ?? []).map(cleanRecoveryDocumentData);
    if (entries.length) {
      await runBatched(entries, batch => documentClass.createDocuments(batch, getPackCreateOptions(pack, { keepId: true })));
    }

    await pack.getIndex();
    notifyInfo(`Restored "${pack.title}" from the automatic pre-replace recovery snapshot.`);
    return true;
  } catch (rollbackError) {
    console.error(`${MODULE_ID} v${getModuleVersion()} | Automatic rollback failed`, rollbackError);
    error(`Import failed and automatic rollback also failed for "${pack.title}". Use the downloaded recovery JSON to restore it manually.`, rollbackError);
    return false;
  }
}

export async function importPackFromPayload(packIdOrPack, jsonTextOrPayload, options = {}) {
  const pack = resolvePack(packIdOrPack);

  if (!pack) {
    warn("Compendium pack not found.");
    return null;
  }

  if (!game.user?.isGM) {
    warn("Only the GM can import compendium packs.");
    return null;
  }

  const mode = options.mode ?? "upsert";
  const preserveIds = options.preserveIds ?? mode !== "new";
  const preserveFolderIds = options.preserveFolderIds ?? mode !== "new";
  let preserveFolders = options.preserveFolders ?? true;
  const allowTypeMismatch = options.allowTypeMismatch ?? false;
  const targetFolderId = normalizeFolderReference(options.targetFolderId ?? null);
  const targetFolder = targetFolderId ? resolveFolderInPack(pack, targetFolderId) : null;

  if (targetFolderId && !targetFolder) {
    warn("Target compendium folder not found.");
    return null;
  }

  if (targetFolderId && mode === "replace") {
    warn("Replace pack mode is not available when importing into a folder. Use the pack import button instead.");
    return null;
  }

  let payload;
  let documentClass;
  let rawEntries;
  let documentIdMap;
  let preflightEntries;

  try {
    payload = normalizeImportPayload(jsonTextOrPayload);
    const exportedDocumentName = payload.pack?.documentName ?? null;
    const targetDocumentName = pack.documentName ?? pack.metadata?.type ?? null;

    if (exportedDocumentName && targetDocumentName && exportedDocumentName !== targetDocumentName && !allowTypeMismatch) {
      warn(`The JSON contains ${exportedDocumentName} documents, but the selected pack accepts ${targetDocumentName}. Import cancelled.`);
      return null;
    }

    documentClass = getDocumentClassForPack(pack);
    if (!documentClass?.createDocuments) throw new Error(`Could not resolve document class for pack type ${targetDocumentName}.`);

    rawEntries = payload.entries ?? [];
    if (!rawEntries.length) {
      warn("The JSON file contains no entries to import.");
      return null;
    }

    documentIdMap = options.documentIdMap instanceof Map
      ? options.documentIdMap
      : buildDocumentIdMap(rawEntries, { preserveIds });

    preflightEntries = prepareEntrySources(rawEntries, {
      preserveIds,
      preserveFolders,
      targetFolderId,
      documentIdMap,
      referencePlan: options.referencePlan ?? []
    });

    preflightImportSources(pack, documentClass, preflightEntries, preserveFolders ? payload.folders : [], { preserveFolderIds });
  } catch (err) {
    error(`Import preflight failed for "${pack.title ?? pack.collection ?? "unknown"}". No compendium data was changed.`, err);
    return null;
  }

  const writeSession = await beginPackWriteSession(pack, options);
  if (!writeSession) return null;

  let recoverySnapshot = null;
  let replaceDeletionStarted = false;

  try {
    const targetDescription = targetFolder ? ` folder "${getFolderName(targetFolder)}" in ${pack.title}` : ` ${pack.title}`;
    notifyInfo(`Importing ${rawEntries.length} documents into${targetDescription}.`);

    let folderStats = { created: 0, updated: 0, deleted: 0, skipped: 0, idMap: new Map() };
    let preDeletedFolderCount = 0;

    if (mode === "replace") {
      recoverySnapshot = await capturePackRecoverySnapshot(pack);
      notifyInfo(`Saved automatic recovery backup before replacing "${pack.title}".`);

      replaceDeletionStarted = true;
      const deleted = await deleteExistingPackDocuments(pack, documentClass);
      preDeletedFolderCount = (await deleteExistingPackFolders(pack)).length;
      notifyInfo(`Deleted ${deleted.length} existing documents and ${preDeletedFolderCount} folders from ${pack.title}.`);
    }

    if (preserveFolders && payload.folders?.length) {
      try {
        folderStats = await importFoldersToPack(pack, payload.folders, {
          mode: mode === "replace" ? "upsert" : mode,
          preserveIds: preserveFolderIds,
          targetFolderId
        });
        folderStats.deleted += preDeletedFolderCount;
      } catch (err) {
        if (mode === "replace") throw err;
        preserveFolders = false;
        console.warn(`${MODULE_ID} v${getModuleVersion()} | Folder import failed. Documents will be imported without folder assignments.`, err);
        warn("Folder import failed. Documents will be imported without folder assignments.");
      }
    }

    const cleanedEntries = prepareEntrySources(rawEntries, {
      preserveIds,
      preserveFolders,
      targetFolderId,
      documentIdMap,
      folderIdMap: folderStats.idMap,
      referencePlan: options.referencePlan ?? []
    });

    let created = [];
    let updated = [];
    let skipped = 0;

    if (mode === "new") {
      created = await runBatched(cleanedEntries, batch => documentClass.createDocuments(batch, getPackCreateOptions(pack, { keepId: true })));
    } else if (mode === "replace") {
      created = await runBatched(cleanedEntries, batch => documentClass.createDocuments(batch, getPackCreateOptions(pack, { keepId: preserveIds })));
    } else {
      const existingIds = await getPackIndexIds(pack);
      const creates = [];
      const updates = [];

      for (const entry of cleanedEntries) {
        const id = documentIdOf(entry);
        if (id && existingIds.has(id)) {
          if (mode === "add") skipped += 1;
          else updates.push(entry);
        } else {
          creates.push(entry);
        }
      }

      created = await runBatched(creates, batch => documentClass.createDocuments(batch, getPackCreateOptions(pack, { keepId: preserveIds })));
      updated = await runBatched(updates, batch => documentClass.updateDocuments(batch, { pack: pack.collection }));
    }

    await pack.getIndex();
    pack.render?.({ force: false });
    ui.compendium?.render?.({ force: false });

    const result = {
      pack: pack.collection,
      mode,
      schema: payload.schema,
      targetFolder: targetFolderId,
      created: created.length,
      updated: updated.length,
      skipped,
      recoveryBackup: recoverySnapshot?.filename ?? null,
      references: {
        remappedDocumentIds: Array.from(documentIdMap.entries()).filter(([oldId, newId]) => oldId && newId && oldId !== newId).length,
        crossPackPlanSize: options.referencePlan?.length ?? 0
      },
      folders: {
        created: folderStats.created,
        updated: folderStats.updated,
        deleted: folderStats.deleted,
        skipped: folderStats.skipped
      }
    };

    notifyInfo(`Import complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped. Folders: ${result.folders.created} created, ${result.folders.updated} updated. References remapped: ${result.references.remappedDocumentIds}.`);
    return result;
  } catch (err) {
    if (mode === "replace" && replaceDeletionStarted && recoverySnapshot) {
      warn(`Replace import failed for "${pack.title}". Attempting automatic rollback.`);
      await restorePackRecoverySnapshot(pack, recoverySnapshot, documentClass);
    }

    error(`Failed to import into compendium: ${pack.title ?? pack.collection ?? "unknown"}`, err);
    return null;
  } finally {
    await restorePackWriteSession(pack, writeSession);
  }
}

export function getImportDialogContent(pack, { targetFolder = null } = {}) {
  const targetPackName = escapeHtml(pack.title ?? pack.collection);
  const folderNote = targetFolder ? `<p><strong>Target folder:</strong> ${escapeHtml(getFolderName(targetFolder))}</p>` : "";
  const replaceOption = targetFolder ? "" : '<option value="replace">Replace pack - backup, delete, then restore from JSON</option>';
  const folderHelp = targetFolder
    ? "Imported root folders will be placed under the selected target folder. Folderless documents will also be placed in the target folder."
    : "Preserve exported folder structure when possible.";

  return `
    <form class="mk-compendiums-import-form">
      <p><strong>Target pack:</strong> ${targetPackName}</p>
      ${folderNote}
      <div class="form-group">
        <label>JSON File</label>
        <input type="file" name="jsonFile" accept="application/json,.json" required />
      </div>
      <div class="form-group">
        <label>Import Mode</label>
        <select name="mode">
          <option value="upsert" selected>Upsert - create new entries and update matching IDs</option>
          <option value="add">Add only - skip entries whose IDs already exist</option>
          <option value="new">Create as new - ignore exported IDs</option>
          ${replaceOption}
        </select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="preserveFolders" checked /> Preserve exported folder structure when possible</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="allowTypeMismatch" /> Allow importing even if exported document type differs from this pack</label>
      </div>
      <p class="notes">
        Use <strong>Upsert</strong> for normal backup restore. Use <strong>Create as new</strong> to duplicate content without preserving IDs.
        Replace mode validates the import first, downloads a recovery backup, and attempts automatic rollback if the restore fails.
        ${folderHelp}
      </p>
    </form>
  `;
}

export async function confirmImportAction({ title = "Confirm Import", content = "<p>Import this JSON into the selected compendium?</p>" } = {}) {
  return confirmDialog({
    title,
    content,
    yesLabel: "Import",
    noLabel: "Cancel",
    yesIcon: "fa-solid fa-file-import",
    defaultYes: false
  });
}

export async function confirmReplacePack(pack) {
  return confirmDialog({
    title: "Replace Compendium Pack?",
    content: `
      <p>Replace all documents and folders in <strong>${escapeHtml(pack.title ?? pack.collection)}</strong>?</p>
      <p>MK-Compendiums will validate the incoming data first, download a recovery JSON before deletion, and attempt automatic rollback if the import fails.</p>
    `,
    yesLabel: "Replace Pack",
    noLabel: "Cancel",
    yesIcon: "fa-solid fa-rotate",
    defaultYes: false
  });
}

function readPackImportForm(form) {
  if (!form) return null;
  const formData = new FormData(form);
  return {
    file: form.querySelector?.('input[name="jsonFile"]')?.files?.[0] ?? null,
    mode: String(formData.get("mode") ?? "upsert"),
    preserveFolders: formData.get("preserveFolders") === "on",
    allowTypeMismatch: formData.get("allowTypeMismatch") === "on"
  };
}

export async function openImportDialog(packIdOrPack, { targetFolderId = null } = {}) {
  const pack = resolvePack(packIdOrPack);

  if (!pack) {
    warn("Compendium pack not found.");
    return null;
  }

  if (!game.user?.isGM) {
    warn("Only the GM can import compendium packs.");
    return null;
  }

  const targetFolder = targetFolderId ? resolveFolderInPack(pack, targetFolderId) : null;
  if (targetFolderId && !targetFolder) {
    warn("Target compendium folder not found.");
    return null;
  }

  const formResult = await waitFormDialog({
    title: targetFolder ? `Import JSON into folder ${getFolderName(targetFolder)}` : `Import JSON into ${pack.title ?? pack.collection}`,
    content: getImportDialogContent(pack, { targetFolder }),
    submitLabel: "Import JSON",
    submitIcon: "fa-solid fa-file-import",
    getResult: readPackImportForm
  });

  if (!formResult) return null;
  if (!formResult.file) {
    warn("Choose a JSON file to import.");
    return null;
  }

  let payload;
  try {
    payload = normalizeImportPayload(await formResult.file.text());
  } catch (err) {
    error("Selected JSON is not a valid MK-Compendiums pack export.", err);
    return null;
  }

  if (formResult.mode === "replace" && !await confirmReplacePack(pack)) return null;

  const entryCount = payload.entries?.length ?? 0;
  const folderCount = payload.folders?.length ?? 0;
  const exportedPackTitle = payload.pack?.title ?? payload.pack?.label ?? payload.pack?.name ?? "JSON export";
  const targetText = targetFolder
    ? `folder <strong>${escapeHtml(getFolderName(targetFolder))}</strong> in <strong>${escapeHtml(pack.title ?? pack.collection)}</strong>`
    : `pack <strong>${escapeHtml(pack.title ?? pack.collection)}</strong>`;

  if (!await confirmImportAction({
    title: "Confirm Compendium Import",
    content: `
      <p>Import <strong>${entryCount}</strong> document(s) and <strong>${folderCount}</strong> folder(s) from <strong>${escapeHtml(exportedPackTitle)}</strong> into ${targetText}?</p>
      <p><strong>Mode:</strong> ${escapeHtml(formResult.mode)}</p>
      <p class="notes">The import is preflight-validated before writes begin. Locked packs are only unlocked after an additional confirmation and are re-locked afterward.</p>
    `
  })) return null;

  return importPackFromPayload(pack, payload, {
    mode: formResult.mode,
    preserveFolders: formResult.preserveFolders,
    allowTypeMismatch: formResult.allowTypeMismatch,
    preserveIds: formResult.mode !== "new",
    preserveFolderIds: formResult.mode !== "new",
    targetFolderId
  });
}

export async function createWorldCompendiumForExportBlock(packExport, targetFolder) {
  const exportedPack = packExport?.pack ?? {};
  const documentName = exportedPack.documentName ?? exportedPack.type ?? null;

  if (!documentName) throw new Error("Cannot create missing compendium pack because the export block does not define a document type.");

  const compendiumClass = getCompendiumCollectionClass();
  if (!compendiumClass?.createCompendium) throw new Error("CompendiumCollection.createCompendium is not available in this Foundry version.");

  const label = exportedPack.label ?? exportedPack.title ?? exportedPack.name ?? "Imported Compendium";
  const name = getAvailableWorldPackName(exportedPack.name ?? label);
  const metadata = {
    name,
    label,
    type: documentName,
    package: "world",
    system: game.system?.id ?? undefined
  };

  const pack = await compendiumClass.createCompendium(metadata);

  if (targetFolder && typeof pack?.setFolder === "function") await pack.setFolder(targetFolder);

  if (pack?.locked && typeof pack.configure === "function") {
    try {
      await pack.configure({ locked: false });
    } catch (err) {
      console.warn(`${MODULE_ID} v${getModuleVersion()} | Created pack could not be unlocked`, pack, err);
    }
  }

  ui.compendium?.render?.({ force: false });
  return pack;
}

export function getDirectoryImportDialogContent(folder) {
  const folderName = escapeHtml(getFolderName(folder));

  return `
    <form class="mk-compendiums-directory-import-form">
      <p><strong>Target compendium folder:</strong> ${folderName}</p>
      <div class="form-group">
        <label>JSON File</label>
        <input type="file" name="jsonFile" accept="application/json,.json" required />
      </div>
      <div class="form-group">
        <label>Import Mode</label>
        <select name="mode">
          <option value="upsert" selected>Upsert - create new entries and update matching IDs</option>
          <option value="add">Add only - skip entries whose IDs already exist</option>
          <option value="new">Create as new - ignore exported IDs</option>
          <option value="replace">Replace matching packs - backup, delete, then restore</option>
        </select>
      </div>
      <div class="form-group"><label><input type="checkbox" name="preserveFolders" checked /> Preserve exported folder structures inside each matching pack</label></div>
      <div class="form-group"><label><input type="checkbox" name="allowTypeMismatch" /> Allow importing even if exported document type differs from the matched pack</label></div>
      <div class="form-group"><label><input type="checkbox" name="createMissingPacks" checked /> Create missing world compendium packs inside this folder</label></div>
      <p class="notes">
        Multi-pack imports use a shared reference map so compendium UUIDs can follow packs and documents that receive new IDs.
        Replace mode creates a recovery backup for every matching pack before deletion.
      </p>
    </form>
  `;
}

export async function confirmReplaceDirectoryPacks(folder, packCount) {
  return confirmDialog({
    title: "Replace Matching Compendium Packs?",
    content: `
      <p>Replace existing content in <strong>${packCount}</strong> matching pack(s) under <strong>${escapeHtml(getFolderName(folder))}</strong>?</p>
      <p>Each pack is preflight-validated and receives its own recovery JSON before deletion. Failed replacements attempt automatic rollback.</p>
    `,
    yesLabel: "Replace Packs",
    noLabel: "Cancel",
    yesIcon: "fa-solid fa-rotate",
    defaultYes: false
  });
}

function sourcePackIdForExportBlock(packExport) {
  const metadata = packExport?.pack ?? {};
  return metadata.id ?? metadata.collection ?? (metadata.packageName && metadata.name ? `${metadata.packageName}.${metadata.name}` : null);
}

function buildDirectoryReferencePlan(importPairs, { preserveIds = true } = {}) {
  return importPairs.map(({ packExport, targetPack }) => ({
    sourcePackId: sourcePackIdForExportBlock(packExport),
    targetPackId: targetPack.collection,
    documentName: packExport?.pack?.documentName ?? targetPack.documentName ?? targetPack.metadata?.type ?? "",
    documentIdMap: buildDocumentIdMap(packExport?.entries ?? [], { preserveIds })
  })).filter(entry => entry.sourcePackId && entry.targetPackId);
}

export async function importCompendiumDirectoryFolderFromPayload(element, jsonTextOrPayload, options = {}) {
  if (!game.user?.isGM) {
    warn("Only the GM can import compendium folders.");
    return null;
  }

  const folder = getDirectoryFolderDataFromElement(element);
  const folderName = getFolderName(folder);
  const availablePackIds = getPackIdsFromDirectoryFolderElement(element);
  const createMissingPacks = options.createMissingPacks ?? true;

  try {
    const payload = normalizeDirectoryImportPayload(jsonTextOrPayload);
    const matches = [];
    const missing = [];
    const skipped = [];

    for (const packExport of payload.packs) {
      const targetPack = findTargetPackForExportBlock(packExport, availablePackIds);
      if (targetPack) matches.push({ packExport, targetPack, created: false });
      else if (createMissingPacks) missing.push(packExport);
      else skipped.push(packExport?.pack?.title ?? packExport?.pack?.id ?? "unknown pack");
    }

    if (!matches.length && !missing.length) {
      warn(`No matching target packs were found under folder "${folderName}".`);
      return { importedPacks: 0, createdPacks: 0, skippedPacks: skipped.length, results: [] };
    }

    if (options.mode === "replace" && matches.length && !await confirmReplaceDirectoryPacks(folder, matches.length)) return null;

    const targetFolderId = documentIdOf(folder);
    const createdPairs = [];

    if (missing.length) {
      if (!targetFolderId) throw new Error("Cannot create missing compendium packs because the target folder ID could not be resolved.");

      notifyInfo(`Creating ${missing.length} missing compendium pack(s) inside "${folderName}".`);
      for (const packExport of missing) {
        const createdPack = await createWorldCompendiumForExportBlock(packExport, targetFolderId);
        if (createdPack) createdPairs.push({ packExport, targetPack: createdPack, created: true });
      }
    }

    const allImports = [...matches, ...createdPairs];
    if (!allImports.length) {
      warn(`No compendium packs could be matched or created under folder "${folderName}".`);
      return { importedPacks: 0, createdPacks: 0, skippedPacks: skipped.length, results: [] };
    }

    const preserveIds = options.preserveIds ?? options.mode !== "new";
    const referencePlan = buildDirectoryReferencePlan(allImports, { preserveIds });
    const mapBySourcePack = new Map(referencePlan.map(entry => [entry.sourcePackId, entry.documentIdMap]));

    notifyInfo(`Importing ${allImports.length} pack(s) into compendium folder "${folderName}" with a shared cross-pack reference map.`);

    const results = [];
    for (const { packExport, targetPack } of allImports) {
      const sourcePackId = sourcePackIdForExportBlock(packExport);
      const result = await importPackFromPayload(targetPack, {
        schema: payload.schema,
        exportScope: "pack-from-directory-folder",
        exporter: payload.exporter,
        pack: packExport.pack,
        entries: packExport.entries ?? [],
        folders: packExport.folders ?? []
      }, {
        ...options,
        referencePlan,
        documentIdMap: mapBySourcePack.get(sourcePackId) ?? undefined,
        packageWriteConfirmed: options.packageWriteConfirmed ?? false
      });
      if (result) results.push(result);
    }

    notifyInfo(`Folder import complete: ${results.length} pack(s) imported, ${createdPairs.length} pack(s) created, ${skipped.length} pack(s) skipped.`);
    ui.compendium?.render?.({ force: false });

    return {
      folder: documentIdOf(folder),
      importedPacks: results.length,
      createdPacks: createdPairs.length,
      skippedPacks: skipped.length,
      skipped,
      referencePlanSize: referencePlan.length,
      results
    };
  } catch (err) {
    error(`Failed to import compendium folder: ${folderName}`, err);
    return null;
  }
}

function readDirectoryImportForm(form) {
  if (!form) return null;
  const formData = new FormData(form);
  return {
    file: form.querySelector?.('input[name="jsonFile"]')?.files?.[0] ?? null,
    mode: String(formData.get("mode") ?? "upsert"),
    preserveFolders: formData.get("preserveFolders") === "on",
    allowTypeMismatch: formData.get("allowTypeMismatch") === "on",
    createMissingPacks: formData.get("createMissingPacks") === "on"
  };
}

export async function openCompendiumDirectoryFolderImportDialog(element) {
  if (!game.user?.isGM) {
    warn("Only the GM can import compendium folders.");
    return null;
  }

  const folder = getDirectoryFolderDataFromElement(element);
  const formResult = await waitFormDialog({
    title: `Import JSON into compendium folder ${getFolderName(folder)}`,
    content: getDirectoryImportDialogContent(folder),
    submitLabel: "Import JSON",
    submitIcon: "fa-solid fa-file-import",
    getResult: readDirectoryImportForm
  });

  if (!formResult) return null;
  if (!formResult.file) {
    warn("Choose a JSON file to import.");
    return null;
  }

  let payload;
  try {
    payload = normalizeDirectoryImportPayload(await formResult.file.text());
  } catch (err) {
    error("Selected JSON is not a valid MK-Compendiums directory-folder export.", err);
    return null;
  }

  if (!await confirmImportAction({
    title: "Confirm Compendium Folder Import",
    content: `
      <p>Import <strong>${payload.packs?.length ?? 0}</strong> pack export(s) containing <strong>${payload.count ?? 0}</strong> document(s) into compendium folder <strong>${escapeHtml(getFolderName(folder))}</strong>?</p>
      <p><strong>Mode:</strong> ${escapeHtml(formResult.mode)}</p>
      <p><strong>Create missing packs:</strong> ${formResult.createMissingPacks ? "Yes" : "No"}</p>
      <p class="notes">Cross-pack compendium UUIDs are remapped when target pack or document IDs change.</p>
    `
  })) return null;

  return importCompendiumDirectoryFolderFromPayload(element, payload, {
    mode: formResult.mode,
    preserveFolders: formResult.preserveFolders,
    allowTypeMismatch: formResult.allowTypeMismatch,
    createMissingPacks: formResult.createMissingPacks,
    preserveIds: formResult.mode !== "new",
    preserveFolderIds: formResult.mode !== "new"
  });
}

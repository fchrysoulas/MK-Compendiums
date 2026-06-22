import { MODULE_ID, MODULE_VERSION } from './constants.js';
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
  getFolderDocumentClass,
  getFolderName,
  getPackCreateOptions,
  getPackFolderIds,
  getPackIdsFromDirectoryFolderElement,
  getPackIndexIds,
  normalizeFolderReference,
  normalizeImportPayload,
  normalizeDirectoryImportPayload,
  notifyInfo,
  resolveFolderInPack,
  resolvePack,
  rewriteDocumentReferences,
  runBatched,
  ensurePackWritable,
  warn
} from './utils.js';

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

  for (const folder of folders) {
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
      // Broken or circular parent references. Add the remaining folders without their parent.
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

  if (!folders?.length) {
    return { created: 0, updated: 0, deleted: 0, skipped: 0, idMap };
  }

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

  if (!await ensurePackWritable(pack)) return null;

  try {
    const payload = normalizeImportPayload(jsonTextOrPayload);
    const exportedDocumentName = payload.pack?.documentName ?? null;
    const targetDocumentName = pack.documentName ?? pack.metadata?.type ?? null;

    if (exportedDocumentName && targetDocumentName && exportedDocumentName !== targetDocumentName && !allowTypeMismatch) {
      warn(`The JSON contains ${exportedDocumentName} documents, but the selected pack accepts ${targetDocumentName}. Import cancelled.`);
      return null;
    }

    const documentClass = getDocumentClassForPack(pack);
    if (!documentClass?.createDocuments) throw new Error(`Could not resolve document class for pack type ${targetDocumentName}.`);

    const rawEntries = payload.entries ?? [];
    if (!rawEntries.length) {
      warn("The JSON file contains no entries to import.");
      return null;
    }

    const targetDescription = targetFolder ? ` folder "${getFolderName(targetFolder)}" in ${pack.title}` : ` ${pack.title}`;
    notifyInfo(`Importing ${rawEntries.length} documents into${targetDescription}.`);

    const documentIdMap = buildDocumentIdMap(rawEntries, { preserveIds });

    let folderStats = { created: 0, updated: 0, deleted: 0, skipped: 0, idMap: new Map() };
    let preDeletedFolderCount = 0;

    if (mode === "replace") {
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
        preserveFolders = false;
        console.warn(`${MODULE_ID} v${MODULE_VERSION} | Folder import failed. Documents will be imported without folder assignments.`, err);
        warn("Folder import failed. Documents will be imported without folder assignments.");
      }
    }

    const cleanedEntries = rawEntries.map(entry => {
      const oldDocumentId = documentIdOf(entry);
      const mappedDocumentId = oldDocumentId ? documentIdMap.get(oldDocumentId) : null;
      const cleaned = cleanDocumentData(entry, { preserveIds, preserveFolders });

      if (mappedDocumentId) cleaned._id = mappedDocumentId;

      const withFolder = rewriteEntryFolderReference(cleaned, folderStats.idMap, { preserveFolders, targetFolderId });
      return rewriteDocumentReferences(withFolder, documentIdMap);
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
    pack.render?.(false);
    ui.compendium?.render?.(false);

    const result = {
      pack: pack.collection,
      mode,
      schema: payload.schema,
      targetFolder: targetFolderId,
      created: created.length,
      updated: updated.length,
      skipped,
      references: {
        remappedDocumentIds: Array.from(documentIdMap.entries()).filter(([oldId, newId]) => oldId && newId && oldId !== newId).length
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
    error(`Failed to import into compendium: ${pack.title ?? pack.collection ?? "unknown"}`, err);
    return null;
  }
}

export function getImportDialogContent(pack, { targetFolder = null } = {}) {
  const folderNote = targetFolder
    ? `<p><strong>Target folder:</strong> ${getFolderName(targetFolder)}</p>`
    : "";
  const replaceOption = targetFolder
    ? ""
    : '<option value="replace">Replace pack - delete target entries first</option>';
  const folderHelp = targetFolder
    ? "Imported root folders will be placed under the selected target folder. Folderless documents will also be placed in the target folder."
    : "Preserve exported folder structure when possible.";

  return `
    <form class="mk-compendiums-import-form">
      <p><strong>Target pack:</strong> ${pack.title ?? pack.collection}</p>
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
        <label>
          <input type="checkbox" name="preserveFolders" checked />
          Preserve exported folder structure when possible
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="allowTypeMismatch" />
          Allow importing even if exported document type differs from this pack
        </label>
      </div>
      <p class="notes">
        Use <strong>Upsert</strong> for normal backup restore. Use <strong>Create as new</strong> to duplicate content without preserving IDs.
        ${folderHelp}
      </p>
    </form>
  `;
}

export async function confirmImportAction({ title = "Confirm Import", content = "<p>Import this JSON into the selected compendium?</p>" } = {}) {
  if (typeof Dialog?.confirm !== "function") return window.confirm("Import this JSON into the selected compendium?");

  return Dialog.confirm({
    title,
    content,
    yes: () => true,
    no: () => false,
    defaultYes: false
  });
}

export async function confirmReplacePack(pack) {
  if (typeof Dialog?.confirm !== "function") return window.confirm(`Replace all entries in ${pack.title}?`);

  return Dialog.confirm({
    title: "Replace Compendium Pack?",
    content: `
      <p>This will delete all existing documents in <strong>${pack.title ?? pack.collection}</strong>, then import the selected JSON.</p>
      <p>This cannot be undone unless you have another backup.</p>
    `,
    yes: () => true,
    no: () => false,
    defaultYes: false
  });
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

  return new Promise(resolve => {
    new Dialog({
      title: targetFolder ? `Import JSON into folder ${getFolderName(targetFolder)}` : `Import JSON into ${pack.title ?? pack.collection}`,
      content: getImportDialogContent(pack, { targetFolder }),
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: "Import JSON",
          callback: async html => {
            const root = html?.[0] ?? html;
            const form = root?.querySelector?.("form") ?? root;
            const fileInput = form?.querySelector?.('input[name="jsonFile"]');
            const file = fileInput?.files?.[0] ?? null;

            if (!file) {
              warn("Choose a JSON file to import.");
              resolve(null);
              return;
            }

            const formData = new FormData(form);
            const mode = String(formData.get("mode") ?? "upsert");
            const preserveFolders = formData.get("preserveFolders") === "on";
            const allowTypeMismatch = formData.get("allowTypeMismatch") === "on";

            const jsonText = await file.text();
            let payload;
            try {
              payload = normalizeImportPayload(jsonText);
            } catch (err) {
              error("Selected JSON is not a valid MK-Compendiums pack export.", err);
              resolve(null);
              return;
            }

            if (mode === "replace" && !await confirmReplacePack(pack)) {
              resolve(null);
              return;
            }

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
                <p><strong>Mode:</strong> ${escapeHtml(mode)}</p>
                <p class="notes">This will change compendium data. Make sure you have a backup if you are updating existing entries.</p>
              `
            })) {
              resolve(null);
              return;
            }

            const result = await importPackFromPayload(pack, payload, {
              mode,
              preserveFolders,
              allowTypeMismatch,
              preserveIds: mode !== "new",
              preserveFolderIds: mode !== "new",
              targetFolderId
            });

            resolve(result);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "import",
      close: () => resolve(null)
    }).render(true);
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

  if (targetFolder && typeof pack?.setFolder === "function") {
    await pack.setFolder(targetFolder);
  }

  if (pack?.locked && typeof pack.configure === "function") {
    try {
      await pack.configure({ locked: false });
    } catch (err) {
      console.warn(`${MODULE_ID} v${MODULE_VERSION} | Created pack could not be unlocked`, pack, err);
    }
  }

  ui.compendium?.render?.(false);
  return pack;
}

export function getDirectoryImportDialogContent(folder) {
  return `
    <form class="mk-compendiums-directory-import-form">
      <p><strong>Target compendium folder:</strong> ${getFolderName(folder)}</p>
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
          <option value="replace">Replace matching packs - delete target pack entries first</option>
        </select>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="preserveFolders" checked />
          Preserve exported folder structures inside each matching pack
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="allowTypeMismatch" />
          Allow importing even if exported document type differs from the matched pack
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="createMissingPacks" checked />
          Create missing world compendium packs inside this folder
        </label>
      </div>
      <p class="notes">
        This imports a multi-pack JSON made by exporting a Compendium Directory folder.
        It matches exported packs to packs already present under this folder. If enabled, missing packs are created as world compendiums and placed inside the selected Compendium Directory folder.
      </p>
    </form>
  `;
}

export async function confirmReplaceDirectoryPacks(folder, packCount) {
  if (typeof Dialog?.confirm !== "function") return window.confirm(`Replace entries in ${packCount} matching pack(s) under ${getFolderName(folder)}?`);

  return Dialog.confirm({
    title: "Replace Matching Compendium Packs?",
    content: `
      <p>This will delete existing documents from <strong>${packCount}</strong> matching pack(s) under <strong>${getFolderName(folder)}</strong>, then import the selected JSON.</p>
      <p>This cannot be undone unless you have another backup.</p>
    `,
    yes: () => true,
    no: () => false,
    defaultYes: false
  });
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

    notifyInfo(`Importing ${allImports.length} pack(s) into compendium folder "${folderName}".`);

    const results = [];
    for (const { packExport, targetPack } of allImports) {
      const result = await importPackFromPayload(targetPack, {
        schema: payload.schema,
        exportScope: "pack-from-directory-folder",
        exporter: payload.exporter,
        pack: packExport.pack,
        entries: packExport.entries ?? [],
        folders: packExport.folders ?? []
      }, options);
      if (result) results.push(result);
    }

    notifyInfo(`Folder import complete: ${results.length} pack(s) imported, ${createdPairs.length} pack(s) created, ${skipped.length} pack(s) skipped.`);

    ui.compendium?.render?.(false);

    return {
      folder: documentIdOf(folder),
      importedPacks: results.length,
      createdPacks: createdPairs.length,
      skippedPacks: skipped.length,
      skipped,
      results
    };
  } catch (err) {
    error(`Failed to import compendium folder: ${folderName}`, err);
    return null;
  }
}

export async function openCompendiumDirectoryFolderImportDialog(element) {
  if (!game.user?.isGM) {
    warn("Only the GM can import compendium folders.");
    return null;
  }

  const folder = getDirectoryFolderDataFromElement(element);

  return new Promise(resolve => {
    new Dialog({
      title: `Import JSON into compendium folder ${getFolderName(folder)}`,
      content: getDirectoryImportDialogContent(folder),
      buttons: {
        import: {
          icon: '<i class="fas fa-file-import"></i>',
          label: "Import JSON",
          callback: async html => {
            const root = html?.[0] ?? html;
            const form = root?.querySelector?.("form") ?? root;
            const fileInput = form?.querySelector?.('input[name="jsonFile"]');
            const file = fileInput?.files?.[0] ?? null;

            if (!file) {
              warn("Choose a JSON file to import.");
              resolve(null);
              return;
            }

            const formData = new FormData(form);
            const mode = String(formData.get("mode") ?? "upsert");
            const preserveFolders = formData.get("preserveFolders") === "on";
            const allowTypeMismatch = formData.get("allowTypeMismatch") === "on";
            const createMissingPacks = formData.get("createMissingPacks") === "on";
            const jsonText = await file.text();
            let payload;
            try {
              payload = normalizeDirectoryImportPayload(jsonText);
            } catch (err) {
              error("Selected JSON is not a valid MK-Compendiums directory-folder export.", err);
              resolve(null);
              return;
            }

            if (!await confirmImportAction({
              title: "Confirm Compendium Folder Import",
              content: `
                <p>Import <strong>${payload.packs?.length ?? 0}</strong> pack export(s) containing <strong>${payload.count ?? 0}</strong> document(s) into compendium folder <strong>${escapeHtml(getFolderName(folder))}</strong>?</p>
                <p><strong>Mode:</strong> ${escapeHtml(mode)}</p>
                <p><strong>Create missing packs:</strong> ${createMissingPacks ? "Yes" : "No"}</p>
                <p class="notes">This will change compendium data. Make sure you have a backup if you are updating existing entries.</p>
              `
            })) {
              resolve(null);
              return;
            }

            const result = await importCompendiumDirectoryFolderFromPayload(element, payload, {
              mode,
              preserveFolders,
              allowTypeMismatch,
              createMissingPacks,
              preserveIds: mode !== "new",
              preserveFolderIds: mode !== "new"
            });

            resolve(result);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "import",
      close: () => resolve(null)
    }).render(true);
  });
}
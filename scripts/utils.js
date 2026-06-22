import { MODULE_ID, MODULE_VERSION, DEFAULT_BATCH_SIZE } from './constants.js';

export function log(...args) {
  console.log(`${MODULE_ID} v${MODULE_VERSION} |`, ...args);
}

export function notifyInfo(message) {
  ui.notifications?.info(message);
  console.log(`${MODULE_ID} v${MODULE_VERSION} | ${message}`);
}

export function warn(message) {
  ui.notifications?.warn(message);
  console.warn(`${MODULE_ID} v${MODULE_VERSION} | ${message}`);
}

export function error(message, err) {
  ui.notifications?.error(message);
  console.error(`${MODULE_ID} v${MODULE_VERSION} | ${message}`, err);
}

export function deepClone(value) {
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function slugifyFilePart(value) {
  return String(value ?? "compendium")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "compendium";
}

export function getPackIdFromContextElement(element) {
  const htmlElement = element?.[0] ?? element;
  if (!htmlElement) return null;

  const closest = htmlElement.closest?.("[data-pack]") ?? htmlElement;
  return closest?.dataset?.pack ?? element?.data?.("pack") ?? null;
}

export function resolvePack(packIdOrPack) {
  if (typeof packIdOrPack === "string") return game.packs.get(packIdOrPack);
  return packIdOrPack ?? null;
}

export function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return Array.from(collection.values());
  return Array.from(collection);
}

export function getDocumentSource(document) {
  if (!document) return null;

  if (typeof document.toObject === "function") return document.toObject();
  if (typeof document.toJSON === "function") return document.toJSON();
  return deepClone(document);
}

export function stripSearchHtml(value) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldIndexDescriptionString(key, parentKey) {
  const keyName = String(key ?? "").toLocaleLowerCase();
  const parentName = String(parentKey ?? "").toLocaleLowerCase();

  if (keyName.includes("description")) return true;
  if (keyName === "desc") return true;
  if (keyName === "content" && ["description", "text", "details", "bio", "biography", "notes", "note"].some(part => parentName.includes(part))) return true;
  if (keyName === "text" && ["description", "details", "bio", "biography", "notes", "note"].some(part => parentName.includes(part))) return true;
  if (keyName === "value" && ["description", "details", "bio", "biography", "notes", "note", "text"].some(part => parentName.includes(part))) return true;
  return false;
}

export function getDocumentDescriptionSearchText(source) {
  const parts = [];
  const seen = new Set();

  const walk = (value, key = "", parentKey = "") => {
    if (value == null) return;

    if (typeof value === "string") {
      if (shouldIndexDescriptionString(key, parentKey)) parts.push(stripSearchHtml(value));
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item, key, parentKey);
      return;
    }

    if (typeof value === "object") {
      if (seen.has(value)) return;
      seen.add(value);

      for (const [childKey, childValue] of Object.entries(value)) {
        walk(childValue, childKey, key);
      }
    }
  };

  walk(source);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function getPackFoldersSource(pack) {
  const folders = collectionValues(pack.folders);
  return folders
    .map(folder => getDocumentSource(folder))
    .filter(Boolean);
}

export function getFolderIdFromContextElement(element) {
  const htmlElement = element?.[0] ?? element;
  if (!htmlElement) return null;

  const closest = htmlElement.closest?.("[data-folder-id], [data-folder], li.folder, .folder") ?? htmlElement;
  const dataset = closest?.dataset ?? {};

  return dataset.folderId
    ?? dataset.folder
    ?? dataset.entryId
    ?? dataset.id
    ?? element?.data?.("folderId")
    ?? element?.data?.("folder")
    ?? element?.data?.("entryId")
    ?? element?.data?.("id")
    ?? null;
}

export function resolveFolderInPack(pack, folderIdOrFolder) {
  if (!pack || !folderIdOrFolder) return null;

  const folderId = documentIdOf(folderIdOrFolder);
  if (!folderId) return null;

  return collectionValues(pack.folders).find(folder => documentIdOf(folder) === folderId) ?? null;
}

export function getFolderName(folder) {
  return folder?.name ?? folder?.label ?? folder?.title ?? documentIdOf(folder) ?? "Folder";
}

export function getFolderColor(folder) {
  return folder?.color
    ?? folder?._source?.color
    ?? folder?.data?.color
    ?? folder?.system?.color
    ?? null;
}

export function collectPackFolderTree(pack, rootFolderId) {
  const folders = collectionValues(pack.folders);
  const byParent = new Map();

  for (const folder of folders) {
    const parentId = normalizeFolderReference(folder?.folder);
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(folder);
  }

  const ids = new Set();
  const queue = [rootFolderId];

  while (queue.length) {
    const folderId = queue.shift();
    if (!folderId || ids.has(folderId)) continue;

    ids.add(folderId);

    for (const child of byParent.get(folderId) ?? []) {
      const childId = documentIdOf(child);
      if (childId && !ids.has(childId)) queue.push(childId);
    }
  }

  return ids;
}

export function getPackFoldersSubsetSource(pack, folderIds) {
  return getPackFoldersSource(pack)
    .filter(folder => folderIds.has(documentIdOf(folder)))
    .map(folder => {
      const data = deepClone(folder);
      const parentId = normalizeFolderReference(data.folder);

      // A folder subset should import as its own tree. If the exported root had
      // a parent outside the subset, detach it so it becomes top-level on import.
      data.folder = parentId && folderIds.has(parentId) ? parentId : null;
      return data;
    });
}

export function getDocumentFolderIdFromSource(data) {
  return normalizeFolderReference(data?.folder);
}

export function getDocumentClassForPack(pack) {
  const documentClass = pack.documentClass
    ?? (typeof getDocumentClass === "function" ? getDocumentClass(pack.documentName) : null)
    ?? CONFIG?.[pack.documentName]?.documentClass
    ?? null;

  return documentClass?.implementation ?? documentClass;
}

export function getFolderDocumentClass() {
  const documentClass = (typeof getDocumentClass === "function" ? getDocumentClass("Folder") : null)
    ?? globalThis.Folder
    ?? CONFIG?.Folder?.documentClass
    ?? null;

  return documentClass?.implementation ?? documentClass;
}

export function documentIdOf(data) {
  if (typeof data === "string") return data;
  return data?._id ?? data?.id ?? null;
}

export function generateDocumentId() {
  if (foundry?.utils?.randomID) return foundry.utils.randomID(16);

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i += 1) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

export function getPackCreateOptions(pack, { keepId = false } = {}) {
  const options = { pack: pack.collection };
  if (keepId) options.keepId = true;
  return options;
}

export function buildDocumentIdMap(entries, { preserveIds = true } = {}) {
  const idMap = new Map();
  const generatedIds = new Set();

  for (const entry of entries ?? []) {
    const oldId = documentIdOf(entry);
    if (!oldId) continue;

    if (preserveIds) {
      idMap.set(oldId, oldId);
      continue;
    }

    let newId = generateDocumentId();
    while (generatedIds.has(newId)) newId = generateDocumentId();
    generatedIds.add(newId);
    idMap.set(oldId, newId);
  }

  return idMap;
}

const REFERENCE_KEY_TOKENS = new Set([
  "_id",
  "id",
  "ids",
  "uuid",
  "uuids",
  "ref",
  "refs",
  "reference",
  "references",
  "origin",
  "sourceid",
  "link",
  "links",
  "target",
  "targets"
]);

const REFERENCE_TEXT_MARKERS = [
  "@UUID[",
  "@Compendium[",
  "Compendium.",
  "Actor.",
  "Adventure.",
  "Cards.",
  "ChatMessage.",
  "Combat.",
  "Item.",
  "JournalEntry.",
  "Macro.",
  "Playlist.",
  "RollTable.",
  "Scene."
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getKeyTokens(key) {
  const text = String(key ?? "");
  const exactTokens = text === "_id" ? ["_id"] : [];

  return [
    ...exactTokens,
    ...text
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter(Boolean)
  ];
}

function hasReferenceKey(key, parentKey = "") {
  return [...getKeyTokens(key), ...getKeyTokens(parentKey)].some(token => REFERENCE_KEY_TOKENS.has(token));
}

function hasReferenceMarker(value) {
  const text = String(value ?? "");
  return REFERENCE_TEXT_MARKERS.some(marker => text.includes(marker));
}

function replaceBoundedIdToken(value, oldId, newId) {
  const pattern = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRegExp(oldId)}(?=$|[^A-Za-z0-9_-])`, "g");
  return value.replace(pattern, (_match, prefix) => `${prefix}${newId}`);
}

export function rewriteStringReferences(value, idMap, { key = "", parentKey = "", isObjectKey = false } = {}) {
  let next = String(value ?? "");

  if (!idMap?.size) return next;

  const exactMatch = idMap.get(next);
  if (exactMatch) return exactMatch;

  if (!hasReferenceMarker(next) && !hasReferenceKey(key, parentKey) && !(isObjectKey && hasReferenceMarker(next))) {
    return next;
  }

  for (const [oldId, newId] of idMap.entries()) {
    if (!oldId || !newId || oldId === newId) continue;
    next = replaceBoundedIdToken(next, oldId, newId);
  }

  return next;
}

export function rewriteValueReferences(value, idMap, key = "", parentKey = "") {
  if (!idMap?.size) return value;

  if (typeof value === "string") {
    return rewriteStringReferences(value, idMap, { key, parentKey });
  }

  if (Array.isArray(value)) {
    return value.map(item => rewriteValueReferences(item, idMap, key, parentKey));
  }

  if (value && typeof value === "object") {
    const rewritten = {};

    for (const [childKey, child] of Object.entries(value)) {
      const rewrittenKey = rewriteStringReferences(childKey, idMap, { key: childKey, parentKey: key, isObjectKey: true });
      rewritten[rewrittenKey] = rewriteValueReferences(child, idMap, childKey, key);
    }

    return rewritten;
  }

  return value;
}

export function rewriteDocumentReferences(data, documentIdMap) {
  if (!documentIdMap?.size) return data;
  return rewriteValueReferences(data, documentIdMap);
}

export function normalizeFolderReference(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id ?? value.id ?? null;
}

export function cleanSystemManagedFields(data) {
  if (!data || typeof data !== "object") return data;

  delete data._stats;
  delete data._key;
  delete data.pack;
  delete data.compendium;
  delete data.uuid;

  return data;
}

export function cleanDocumentData(input, { preserveIds = true, preserveFolders = true } = {}) {
  const data = cleanSystemManagedFields(deepClone(input));

  if (!preserveIds) delete data._id;
  else if (!data._id && data.id) data._id = data.id;

  delete data.id;

  if (preserveFolders) data.folder = normalizeFolderReference(data.folder);
  else data.folder = null;

  return data;
}

export function cleanFolderData(input, pack, { preserveIds = true } = {}) {
  const data = cleanSystemManagedFields(deepClone(input));

  if (!data._id && data.id) data._id = data.id;
  if (!preserveIds) delete data._id;
  delete data.id;

  data.type = pack.documentName;
  data.folder = normalizeFolderReference(data.folder);

  return data;
}

export function extractEntriesFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.entries)) return payload.entries;
  if (Array.isArray(payload?.documents)) return payload.documents;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function extractFoldersFromPayload(payload) {
  if (Array.isArray(payload?.folders)) return payload.folders;
  if (Array.isArray(payload?.pack?.folders)) return payload.pack.folders;
  return [];
}

export function extractPackBlocksFromPayload(payload) {
  if (Array.isArray(payload?.packs)) return payload.packs;
  return [];
}

export function normalizeImportPayload(jsonTextOrPayload) {
  const payload = typeof jsonTextOrPayload === "string"
    ? JSON.parse(jsonTextOrPayload)
    : jsonTextOrPayload;

  const entries = extractEntriesFromPayload(payload);
  const folders = extractFoldersFromPayload(payload);

  if (!Array.isArray(entries)) throw new Error("Import file does not contain a valid entries array.");

  return {
    schema: Array.isArray(payload) ? "raw-array" : payload?.schema ?? "unknown",
    exportScope: Array.isArray(payload) ? "raw-array" : payload?.exportScope ?? null,
    exporter: Array.isArray(payload) ? null : payload?.exporter ?? null,
    pack: Array.isArray(payload) ? null : payload?.pack ?? null,
    entries,
    folders
  };
}

export function normalizeDirectoryImportPayload(jsonTextOrPayload) {
  const payload = typeof jsonTextOrPayload === "string"
    ? JSON.parse(jsonTextOrPayload)
    : jsonTextOrPayload;

  const packs = extractPackBlocksFromPayload(payload);
  if (!Array.isArray(packs) || !packs.length) throw new Error("Import file does not contain a valid packs array.");

  return {
    schema: payload?.schema ?? "unknown",
    exportScope: payload?.exportScope ?? null,
    exporter: payload?.exporter ?? null,
    compendiumFolder: payload?.compendiumFolder ?? null,
    packs
  };
}

export async function getPackIndexIds(pack) {
  const index = await pack.getIndex();
  return new Set(collectionValues(index).map(entry => entry?._id ?? entry?.id).filter(Boolean));
}

export function getPackFolderIds(pack) {
  return new Set(collectionValues(pack.folders).map(folder => folder?._id ?? folder?.id).filter(Boolean));
}

export async function runBatched(items, worker, batchSize = DEFAULT_BATCH_SIZE) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    if (!batch.length) continue;
    const batchResult = await worker(batch, i);
    if (Array.isArray(batchResult)) results.push(...batchResult);
  }

  return results;
}

export async function ensurePackWritable(pack) {
  if (!pack?.locked) return true;

  try {
    if (typeof pack.configure === "function") await pack.configure({ locked: false });
  } catch (err) {
    console.warn(`${MODULE_ID} v${MODULE_VERSION} | Could not unlock compendium`, err);
  }

  if (pack.locked) {
    warn(`The compendium "${pack.title}" is locked. Unlock it before importing.`);
    return false;
  }

  return true;
}

export function getPackMetadata(pack, { rootFolder = null } = {}) {
  const packId = pack.collection ?? pack.metadata?.id ?? pack.metadata?.name ?? "unknown-pack";
  const title = pack.title ?? pack.metadata?.label ?? packId;

  return {
    id: packId,
    title,
    documentName: pack.documentName ?? pack.metadata?.type ?? null,
    packageName: pack.metadata?.packageName ?? pack.metadata?.package ?? null,
    name: pack.metadata?.name ?? null,
    label: pack.metadata?.label ?? null,
    path: pack.metadata?.path ?? null,
    banner: pack.banner ?? null,
    rootFolder
  };
}

export function buildExporterMetadata(exportedAt, scope) {
  return {
    moduleId: MODULE_ID,
    moduleVersion: MODULE_VERSION,
    foundryVersion: game.version ?? game.data?.version ?? null,
    systemId: game.system?.id ?? null,
    systemVersion: game.system?.version ?? null,
    worldId: game.world?.id ?? null,
    exportedAt,
    scope
  };
}

export function getPackIdsFromDirectoryFolderElement(element) {
  const htmlElement = element?.[0] ?? element;
  if (!htmlElement?.querySelectorAll) return [];

  const packIds = new Set();

  for (const packElement of htmlElement.querySelectorAll("[data-pack]")) {
    const packId = packElement?.dataset?.pack;
    if (packId) packIds.add(packId);
  }

  return Array.from(packIds);
}

export function getDirectoryFolderDataFromElement(element) {
  const htmlElement = element?.[0] ?? element;
  const folderId = getFolderIdFromContextElement(htmlElement);
  const folder = folderId ? game.folders?.get?.(folderId) : null;

  return folder ?? {
    _id: folderId,
    name: htmlElement?.querySelector?.(":scope > .folder-header .folder-name, :scope > header .folder-name, .folder-header .folder-name, .folder-name")?.textContent?.trim()
      ?? htmlElement?.dataset?.folderName
      ?? folderId
      ?? "Compendium Folder"
  };
}

export function getPackMatchKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function findTargetPackForExportBlock(packExport, availablePackIds) {
  const exportedPack = packExport?.pack ?? {};
  const availablePacks = availablePackIds.map(id => resolvePack(id)).filter(Boolean);
  const exportedId = exportedPack.id ?? exportedPack.collection ?? null;

  if (exportedId && availablePackIds.includes(exportedId)) return resolvePack(exportedId);

  const exportedDocumentName = exportedPack.documentName ?? null;
  const exportedName = getPackMatchKey(exportedPack.name);
  const exportedLabel = getPackMatchKey(exportedPack.label ?? exportedPack.title);

  return availablePacks.find(pack => {
    const documentName = pack.documentName ?? pack.metadata?.type ?? null;
    if (exportedDocumentName && documentName && exportedDocumentName !== documentName) return false;

    const packName = getPackMatchKey(pack.metadata?.name);
    const packLabel = getPackMatchKey(pack.metadata?.label ?? pack.title);
    return (!!exportedName && exportedName === packName) || (!!exportedLabel && exportedLabel === packLabel);
  }) ?? null;
}

export function getCompendiumCollectionClass() {
  return foundry?.documents?.collections?.CompendiumCollection
    ?? globalThis.CompendiumCollection
    ?? null;
}

export function normalizePackName(value) {
  return String(value ?? "imported-pack")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "imported-pack";
}

export function worldPackNameExists(name) {
  const key = `world.${name}`;
  if (game.packs?.get?.(key)) return true;

  return collectionValues(game.packs).some(pack => {
    const packageName = pack?.metadata?.packageName ?? pack?.metadata?.package ?? null;
    const packName = pack?.metadata?.name ?? null;
    return packName === name && (!packageName || packageName === "world");
  });
}

export function getAvailableWorldPackName(baseName) {
  const cleanBase = normalizePackName(baseName);
  let name = cleanBase;
  let suffix = 2;

  while (worldPackNameExists(name)) {
    name = `${cleanBase}-${suffix}`;
    suffix += 1;
  }

  return name;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getPackTitle(pack) {
  return pack?.title ?? pack?.metadata?.label ?? pack?.collection ?? "Compendium";
}

export function getPackPackageName(pack) {
  return pack?.metadata?.packageName
    ?? pack?.metadata?.package
    ?? pack?.metadata?.packageType
    ?? "world";
}

export function getPackDirectoryFolder(pack) {
  const rawFolder = pack?.folder ?? pack?.metadata?.folder ?? null;
  if (!rawFolder) return null;
  if (typeof rawFolder === "string") return game.folders?.get?.(rawFolder) ?? { _id: rawFolder, name: rawFolder };
  return rawFolder;
}

export function getPackDirectoryFolderName(pack) {
  const folder = getPackDirectoryFolder(pack);
  return folder ? getFolderName(folder) : "No sidebar folder";
}

export function packHasDocumentExportApi(pack) {
  return !!pack && typeof pack.getDocuments === "function";
}

export function getExportablePacks() {
  return collectionValues(game.packs)
    .filter(packHasDocumentExportApi)
    .sort((a, b) => getPackTitle(a).localeCompare(getPackTitle(b)));
}

export function getBrowserPackMeta(pack) {
  return {
    id: pack.collection ?? pack.metadata?.id ?? pack.metadata?.name ?? "",
    title: getPackTitle(pack),
    documentName: pack.documentName ?? pack.metadata?.type ?? "Unknown",
    packageName: getPackPackageName(pack),
    sidebarFolder: getPackDirectoryFolderName(pack),
    locked: !!pack.locked
  };
}

export function resetCompendiumIndexCache(pack) {
  if (!pack) return;

  // Foundry keeps compendium indexes cached on the pack. The public API differs a
  // little between versions, so this only touches cache-like fields when they
  // exist and silently ignores read-only fields. This lets the browser refresh
  // after importing or editing compendium contents.
  try {
    if (pack.index && typeof pack.index.clear === "function") pack.index.clear();
  } catch (_err) {
    // Non-fatal.
  }

  try {
    if ("indexed" in pack) pack.indexed = false;
  } catch (_err) {
    // Non-fatal.
  }

  try {
    if ("_indexed" in pack) pack._indexed = false;
  } catch (_err) {
    // Non-fatal.
  }
}

export async function getBrowserPackIndex(pack, { force = false } = {}) {
  if (!pack) return [];
  if (force) resetCompendiumIndexCache(pack);

  let index;
  try {
    index = await pack.getIndex({ fields: ["name", "img", "thumb", "thumbnail", "type", "folder", "sort"], force });
  } catch (_err) {
    index = await pack.getIndex();
  }

  return collectionValues(index).map(entry => ({
    id: entry?._id ?? entry?.id ?? null,
    name: entry?.name ?? "(Unnamed)",
    img: entry?.img ?? entry?.thumb ?? entry?.thumbnail ?? "icons/svg/book.svg",
    type: entry?.type ?? pack.documentName ?? pack.metadata?.type ?? "Document",
    folder: normalizeFolderReference(entry?.folder),
    sort: entry?.sort ?? 0,
    packId: pack.collection ?? pack.metadata?.id ?? pack.metadata?.name ?? "",
    packTitle: getPackTitle(pack),
    documentName: pack.documentName ?? pack.metadata?.type ?? "Unknown",
    packageName: getPackPackageName(pack),
    uuid: entry?.uuid ?? `Compendium.${pack.collection}.${entry?._id ?? entry?.id ?? ""}`
  })).filter(entry => entry.id);
}

export function getFolderPathForBrowser(pack, folderId) {
  let folder = resolveFolderInPack(pack, folderId);
  if (!folder) return "";

  const parts = [];
  const seen = new Set();

  while (folder && !seen.has(documentIdOf(folder))) {
    const id = documentIdOf(folder);
    seen.add(id);
    parts.unshift(getFolderName(folder));
    const parentId = normalizeFolderReference(folder.folder);
    folder = parentId ? resolveFolderInPack(pack, parentId) : null;
  }

  return parts.join(" / ");
}

export function getBrowserFolderRows(pack) {
  const folders = collectionValues(pack?.folders);
  const byParent = new Map();

  for (const folder of folders) {
    const parent = normalizeFolderReference(folder?.folder);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent).push(folder);
  }

  for (const children of byParent.values()) {
    children.sort((a, b) => getFolderName(a).localeCompare(getFolderName(b)));
  }

  const rows = [];
  const seen = new Set();

  const walk = (parent, depth) => {
    for (const folder of byParent.get(parent) ?? []) {
      const id = documentIdOf(folder);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({ id, name: getFolderName(folder), depth, color: getFolderColor(folder) });
      walk(id, depth + 1);
    }
  };

  walk(null, 0);
  walk(undefined, 0);

  for (const folder of folders) {
    const id = documentIdOf(folder);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, name: getFolderName(folder), depth: 0, color: getFolderColor(folder) });
  }

  return rows;
}

export function readBrowserStateFromForm(root, state) {
  state.query = root.querySelector('[name="query"]')?.value?.trim() ?? "";
  state.documentName = root.querySelector('[name="documentName"]')?.value ?? "";
  state.entryType = root.querySelector('[name="entryType"]')?.value ?? "";
  state.packageName = root.querySelector('[name="packageName"]')?.value ?? "";
  state.packId = root.querySelector('[name="packId"]')?.value ?? state.packId ?? "";
}

export function optionAlreadyRegistered(options, name) {
  return options.some(option => option?.name === name);
}

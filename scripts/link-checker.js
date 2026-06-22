import {
  collectionValues,
  deepClone,
  documentIdOf,
  ensurePackWritable,
  error,
  escapeHtml,
  getDocumentClassForPack,
  getDocumentSource,
  getFolderName,
  getPackTitle,
  normalizeFolderReference,
  notifyInfo,
  resetCompendiumIndexCache,
  resolvePack,
  warn
} from './utils.js';

const INLINE_UUID_PATTERN = /@UUID\[([^\]]+)\](\{[^}]*\})?/g;
const INLINE_COMPENDIUM_PATTERN = /@Compendium\[([^\]]+)\](\{[^}]*\})?/g;
const DIRECT_UUID_PATTERN = /\bCompendium\.[^\s\]\[\{\}<>"']+/g;
const TRAILING_REFERENCE_PUNCTUATION = /[.,;:!?)}\]]+$/;

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTrailingReferencePunctuation(value) {
  return String(value ?? "").replace(TRAILING_REFERENCE_PUNCTUATION, "");
}

function getPackIdFromLegacyCompendiumUuid(value) {
  const parts = String(value ?? "").split(".");
  if (parts.length < 3) return null;

  const packId = `${parts[0]}.${parts[1]}`;
  return game.packs?.get?.(packId) ? packId : null;
}

function getPackDocumentName(pack) {
  return pack?.documentName ?? pack?.metadata?.type ?? "Document";
}

function packCanContainItems(pack) {
  return ["Item", "Actor"].includes(getPackDocumentName(pack));
}

function getEmbeddedItems(source) {
  if (Array.isArray(source?.items)) return source.items;
  if (Array.isArray(source?.items?.contents)) return source.items.contents;
  return [];
}

function getItemSourceUuid(pack, documentId, itemId, { actorId = null } = {}) {
  if (actorId && itemId) return `Compendium.${pack.collection}.${actorId}.Item.${itemId}`;
  return `Compendium.${pack.collection}.${documentId}`;
}

function getWorldItemSourceUuid(documentId, itemId, { actorId = null } = {}) {
  if (actorId && itemId) return `Actor.${actorId}.Item.${itemId}`;
  return `Item.${documentId}`;
}

function getWorldFolderName(folderId) {
  if (!folderId) return "";
  const folder = game.folders?.get?.(folderId);
  return folder ? getFolderName(folder) : String(folderId);
}

function getItemContexts(pack, document, source, documentId) {
  const documentName = getPackDocumentName(pack);

  if (documentName === "Item") {
    const itemId = documentIdOf(source) ?? documentId;
    return [{
      itemSource: source,
      itemPath: [],
      itemId,
      actorId: null,
      actorName: "",
      actorType: "",
      actorUuid: "",
      containerName: "",
      containerType: "Compendium Item"
    }];
  }

  if (documentName !== "Actor") return [];

  const actorId = documentIdOf(source) ?? documentId;
  const actorName = source?.name ?? document?.name ?? "(Unnamed Actor)";
  const actorType = source?.type ?? "Actor";
  const actorUuid = `Compendium.${pack.collection}.${actorId}`;

  return getEmbeddedItems(source)
    .map((itemSource, index) => ({
      itemSource,
      itemPath: ["items", index],
      itemId: documentIdOf(itemSource),
      actorId,
      actorName,
      actorType,
      actorUuid,
      containerName: actorName,
      containerType: actorType
    }))
    .filter(context => context.itemSource && context.itemId);
}

function getWorldItemContexts(document, source, documentName) {
  const documentId = documentIdOf(source) ?? documentIdOf(document);
  if (!documentId) return [];

  if (documentName === "Item") {
    return [{
      itemSource: source,
      itemPath: [],
      itemId: documentId,
      actorId: null,
      actorName: "",
      actorType: "",
      actorUuid: "",
      containerName: "",
      containerType: "World Item"
    }];
  }

  if (documentName !== "Actor") return [];

  const actorName = source?.name ?? document?.name ?? "(Unnamed Actor)";
  const actorType = source?.type ?? "Actor";
  const actorUuid = `Actor.${documentId}`;

  return getEmbeddedItems(source)
    .map((itemSource, index) => ({
      itemSource,
      itemPath: ["items", index],
      itemId: documentIdOf(itemSource),
      actorId: documentId,
      actorName,
      actorType,
      actorUuid,
      containerName: actorName,
      containerType: actorType
    }))
    .filter(context => context.itemSource && context.itemId);
}

export function normalizeReferenceUuid(value, { legacyCompendium = false } = {}) {
  let text = String(value ?? "").trim();
  if (!text) return "";

  const uuidMatch = text.match(/^@UUID\[([^\]]+)\]/);
  if (uuidMatch) text = uuidMatch[1].trim();

  const compendiumMatch = text.match(/^@Compendium\[([^\]]+)\]/);
  if (compendiumMatch) {
    text = compendiumMatch[1].trim();
    legacyCompendium = true;
  }

  text = stripTrailingReferencePunctuation(text);

  if (legacyCompendium && !text.startsWith("Compendium.")) return `Compendium.${text}`;
  if (!text.startsWith("Compendium.") && getPackIdFromLegacyCompendiumUuid(text)) return `Compendium.${text}`;
  return text;
}

export function isPotentialCompendiumUuid(value) {
  const uuid = normalizeReferenceUuid(value);
  return uuid.startsWith("Compendium.") && uuid.split(".").length >= 4;
}

function normalizeReplacementUuid(value) {
  const uuid = normalizeReferenceUuid(value);
  return isPotentialCompendiumUuid(uuid) ? uuid : "";
}

function getLabelFromInlineSuffix(labelSuffix) {
  if (!labelSuffix) return "";
  return labelSuffix.replace(/^\{|\}$/g, "");
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function formatReferencePath(path) {
  if (!Array.isArray(path) || !path.length) return "(root)";

  return path.map((part, index) => {
    if (typeof part === "number") return `[${part}]`;
    const key = String(part);
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return index ? `.${key}` : key;
    return `[${JSON.stringify(key)}]`;
  }).join("");
}

function getValueAtPath(source, path) {
  let current = source;
  for (const part of path ?? []) current = current?.[part];
  return current;
}

function setValueAtPath(source, path, value) {
  if (!source || !Array.isArray(path) || !path.length) return false;

  let current = source;
  for (let i = 0; i < path.length - 1; i += 1) {
    current = current?.[path[i]];
    if (!current) return false;
  }

  current[path[path.length - 1]] = value;
  return true;
}

function getUpdatePath(path) {
  if (!Array.isArray(path) || !path.length) return "";
  if (path.some(part => typeof part === "string" && part.includes("."))) return "";
  return path.map(part => String(part)).join(".");
}

function addReference(references, seen, data) {
  const rawUuid = String(data.rawUuid ?? "").trim();
  const normalizedUuid = normalizeReferenceUuid(rawUuid, { legacyCompendium: data.syntax === "inline-compendium" });

  if (!rawUuid || !isPotentialCompendiumUuid(normalizedUuid)) return;

  const key = `${data.pathLabel}|${data.syntax}|${rawUuid}|${data.start ?? 0}`;
  if (seen.has(key)) return;
  seen.add(key);

  references.push({
    ...data,
    rawUuid,
    normalizedUuid
  });
}

function extractReferencesFromString(value, path) {
  const text = String(value ?? "");
  const references = [];
  const seen = new Set();
  const inlineRanges = [];
  const pathLabel = formatReferencePath(path);

  for (const match of text.matchAll(INLINE_UUID_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    inlineRanges.push([start, end]);
    addReference(references, seen, {
      syntax: "inline-uuid",
      rawUuid: match[1],
      label: getLabelFromInlineSuffix(match[2]),
      path,
      pathLabel,
      sourceValue: text,
      start,
      end
    });
  }

  for (const match of text.matchAll(INLINE_COMPENDIUM_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    inlineRanges.push([start, end]);
    addReference(references, seen, {
      syntax: "inline-compendium",
      rawUuid: match[1],
      label: getLabelFromInlineSuffix(match[2]),
      path,
      pathLabel,
      sourceValue: text,
      start,
      end
    });
  }

  const exactUuid = normalizeReferenceUuid(text);
  if (text.trim() && isPotentialCompendiumUuid(exactUuid)) {
    addReference(references, seen, {
      syntax: "direct",
      rawUuid: text.trim(),
      label: "",
      path,
      pathLabel,
      sourceValue: text,
      start: 0,
      end: text.length,
      exact: true
    });
  }

  for (const match of text.matchAll(DIRECT_UUID_PATTERN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (inlineRanges.some(([rangeStart, rangeEnd]) => rangesOverlap(start, end, rangeStart, rangeEnd))) continue;

    const rawUuid = stripTrailingReferencePunctuation(match[0]);
    addReference(references, seen, {
      syntax: "direct",
      rawUuid,
      label: "",
      path,
      pathLabel,
      sourceValue: text,
      start,
      end: start + rawUuid.length
    });
  }

  return references;
}

function pathPartEquals(value, expected) {
  return String(value ?? "").toLowerCase() === expected;
}

function shouldSkipPath(path) {
  if (!Array.isArray(path) || !path.length) return false;
  if (pathPartEquals(path[0], "_stats")) return true;

  const isFlagsPath = pathPartEquals(path[0], "flags");
  if (isFlagsPath && pathPartEquals(path[1], "scene-packer")) return true;
  if (isFlagsPath && pathPartEquals(path[1], "core") && pathPartEquals(path[path.length - 1], "sourceid")) return true;

  return false;
}

export function findUuidReferencesInSource(source) {
  const references = [];
  const seenObjects = new Set();

  const walk = (value, path = []) => {
    if (value == null || shouldSkipPath(path)) return;

    if (typeof value === "string") {
      references.push(...extractReferencesFromString(value, path));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, [...path, index]));
      return;
    }

    if (typeof value === "object") {
      if (seenObjects.has(value)) return;
      seenObjects.add(value);

      for (const [key, child] of Object.entries(value)) walk(child, [...path, key]);
    }
  };

  walk(source);
  return references;
}

async function resolveUuid(uuid, cache) {
  if (!uuid) return { found: false, reason: "Empty UUID." };
  if (!isPotentialCompendiumUuid(uuid)) return { found: false, reason: "UUID is not a compendium UUID." };
  if (cache?.has(uuid)) return cache.get(uuid);

  const promise = (async () => {
    try {
      if (typeof globalThis.fromUuid === "function") {
        const document = await globalThis.fromUuid(uuid);
        if (document) return { found: true, document };
      }
    } catch (err) {
      return { found: false, reason: err?.message ?? "UUID resolution failed." };
    }

    return { found: false, reason: "Target document was not found." };
  })();

  cache?.set(uuid, promise);
  return promise;
}

async function collectBrokenLinksForItemContext({
  brokenLinks,
  resolutionCache,
  sourceScope,
  itemContext,
  documentId,
  documentName,
  folderId = null,
  folderName = "",
  pack = null,
  packTitle = "",
  worldCollection = ""
}) {
  const itemSource = itemContext.itemSource;
  const itemId = itemContext.itemId;
  const itemName = itemSource?.name ?? "(Unnamed Item)";
  const itemType = itemSource?.type ?? "Item";
  const itemImg = itemSource?.img ?? itemSource?.thumb ?? itemSource?.thumbnail ?? "icons/svg/item-bag.svg";

  for (const reference of findUuidReferencesInSource(itemSource)) {
    const fullPath = [...itemContext.itemPath, ...reference.path];
    const fullPathLabel = formatReferencePath(fullPath);
    const resolution = await resolveUuid(reference.normalizedUuid, resolutionCache);
    if (resolution.found) continue;

    const sourceUuid = sourceScope === "world"
      ? getWorldItemSourceUuid(documentId, itemId, { actorId: itemContext.actorId })
      : getItemSourceUuid(pack, documentId, itemId, { actorId: itemContext.actorId });

    brokenLinks.push({
      id: `${sourceScope}:${pack?.collection ?? worldCollection}:${documentId}:${itemId}:${fullPathLabel}:${reference.normalizedUuid}:${reference.start ?? 0}`,
      sourceScope,
      packId: pack?.collection ?? "",
      packTitle: packTitle || (sourceScope === "world" ? "World" : getPackTitle(pack)),
      worldCollection,
      documentName,
      documentId,
      folderId,
      folderName,
      itemId,
      itemName,
      itemType,
      itemImg,
      actorId: itemContext.actorId,
      actorName: itemContext.actorName,
      actorType: itemContext.actorType,
      actorUuid: itemContext.actorUuid,
      containerName: itemContext.containerName,
      containerType: itemContext.containerType,
      sourceName: itemName,
      sourceType: itemType,
      sourceImg: itemImg,
      sourceUuid,
      reason: resolution.reason,
      ...reference,
      path: fullPath,
      pathLabel: fullPathLabel,
      referencePath: reference.path,
      referencePathLabel: reference.pathLabel,
      itemPath: itemContext.itemPath,
      itemPathLabel: formatReferencePath(itemContext.itemPath)
    });
  }
}

function sortBrokenLinks(brokenLinks) {
  return brokenLinks.sort((a, b) =>
    (a.sourceScope ?? "").localeCompare(b.sourceScope ?? "")
    || (a.packTitle ?? "").localeCompare(b.packTitle ?? "")
    || (a.sourceName ?? "").localeCompare(b.sourceName ?? "")
    || (a.pathLabel ?? "").localeCompare(b.pathLabel ?? "")
    || (a.normalizedUuid ?? "").localeCompare(b.normalizedUuid ?? "")
  );
}

export async function findBrokenLinksInPacks(packs, { shouldScanDocument = null, onPackScanned = null, resolutionCache = new Map() } = {}) {
  const brokenLinks = [];

  for (const pack of packs ?? []) {
    if (!pack?.getDocuments) continue;
    if (!packCanContainItems(pack)) continue;

    let documents = [];
    try {
      documents = await pack.getDocuments();
    } catch (err) {
      console.warn(`MK-Compendiums | Could not load documents for link check in ${getPackTitle(pack)}.`, err);
      onPackScanned?.(pack, { failed: true });
      continue;
    }

    for (const document of documents) {
      const source = getDocumentSource(document);
      const documentId = documentIdOf(source) ?? documentIdOf(document);
      if (!source || !documentId) continue;
      if (shouldScanDocument && !shouldScanDocument(document, source, pack)) continue;

      for (const itemContext of getItemContexts(pack, document, source, documentId)) {
        await collectBrokenLinksForItemContext({
          brokenLinks,
          resolutionCache,
          sourceScope: "compendium",
          itemContext,
          documentId,
          documentName: getPackDocumentName(pack),
          folderId: normalizeFolderReference(source?.folder),
          pack,
          packTitle: getPackTitle(pack)
        });
      }
    }

    onPackScanned?.(pack, { failed: false });
  }

  return sortBrokenLinks(brokenLinks);
}

export async function findBrokenLinksInWorld({ includeItems = true, includeActors = true, resolutionCache = new Map() } = {}) {
  const brokenLinks = [];
  const worldDocuments = [];

  if (includeItems) {
    for (const document of collectionValues(game.items)) {
      worldDocuments.push({ document, documentName: "Item", worldCollection: "World Items" });
    }
  }

  if (includeActors) {
    for (const document of collectionValues(game.actors)) {
      worldDocuments.push({ document, documentName: "Actor", worldCollection: "World Actors" });
    }
  }

  for (const { document, documentName, worldCollection } of worldDocuments) {
    const source = getDocumentSource(document);
    const documentId = documentIdOf(source) ?? documentIdOf(document);
    if (!source || !documentId) continue;

    const folderId = normalizeFolderReference(source?.folder);
    const folderName = getWorldFolderName(folderId);

    for (const itemContext of getWorldItemContexts(document, source, documentName)) {
      await collectBrokenLinksForItemContext({
        brokenLinks,
        resolutionCache,
        sourceScope: "world",
        itemContext,
        documentId,
        documentName,
        folderId,
        folderName,
        packTitle: worldCollection,
        worldCollection
      });
    }
  }

  return sortBrokenLinks(brokenLinks);
}

function replaceInlineUuid(text, rawUuid, replacementUuid) {
  const pattern = new RegExp(`@UUID\\[${escapeRegExp(rawUuid)}\\]`, "g");
  return text.replace(pattern, `@UUID[${replacementUuid}]`);
}

function replaceInlineCompendium(text, rawUuid, replacementUuid) {
  const pattern = new RegExp(`@Compendium\\[${escapeRegExp(rawUuid)}\\]`, "g");
  return text.replace(pattern, `@UUID[${replacementUuid}]`);
}

function replaceDirectUuid(text, rawUuid, normalizedUuid, replacementUuid) {
  const exact = text.trim();
  if (exact === rawUuid || exact === normalizedUuid) return replacementUuid;

  let next = text.replaceAll(rawUuid, replacementUuid);
  if (normalizedUuid !== rawUuid) next = next.replaceAll(normalizedUuid, replacementUuid);
  return next;
}

function clearInlineReference(text, syntax, rawUuid) {
  const command = syntax === "inline-compendium" ? "Compendium" : "UUID";
  const pattern = new RegExp(`@${command}\\[${escapeRegExp(rawUuid)}\\](\\{([^}]*)\\})?`, "g");
  return text.replace(pattern, (_match, _labelWrapper, label) => label ?? "");
}

function clearDirectUuid(text, rawUuid, normalizedUuid) {
  const exact = text.trim();
  if (exact === rawUuid || exact === normalizedUuid) return "";

  let next = text.replaceAll(rawUuid, "");
  if (normalizedUuid !== rawUuid) next = next.replaceAll(normalizedUuid, "");
  return next.replace(/\s{2,}/g, " ").trim();
}

function getFixedStringValue(currentValue, link, { replacementUuid = "", clear = false } = {}) {
  const text = String(currentValue ?? "");

  if (clear) {
    if (link.syntax === "inline-uuid" || link.syntax === "inline-compendium") return clearInlineReference(text, link.syntax, link.rawUuid);
    return clearDirectUuid(text, link.rawUuid, link.normalizedUuid);
  }

  if (link.syntax === "inline-uuid") return replaceInlineUuid(text, link.rawUuid, replacementUuid);
  if (link.syntax === "inline-compendium") return replaceInlineCompendium(text, link.rawUuid, replacementUuid);
  return replaceDirectUuid(text, link.rawUuid, link.normalizedUuid, replacementUuid);
}

async function validateReplacementUuid(replacementUuid, { clear = false } = {}) {
  const normalizedReplacement = clear ? "" : normalizeReplacementUuid(replacementUuid);
  if (clear) return normalizedReplacement;

  if (!normalizedReplacement) {
    warn("Enter a valid compendium UUID, such as Compendium.package.pack.documentId.");
    return null;
  }

  const resolution = await resolveUuid(normalizedReplacement, new Map());
  if (!resolution.found) {
    warn(`Replacement compendium UUID could not be resolved: ${normalizedReplacement}`);
    return null;
  }

  return normalizedReplacement;
}

async function applyWorldBrokenLinkFix(link, { replacementUuid = "", clear = false } = {}) {
  const normalizedReplacement = await validateReplacementUuid(replacementUuid, { clear });
  if (normalizedReplacement === null) return null;

  try {
    const isEmbeddedItem = !!link.actorId;
    const document = isEmbeddedItem
      ? game.actors?.get?.(link.actorId)
      : game.items?.get?.(link.documentId);

    if (!document) {
      warn(isEmbeddedItem ? "Assigned actor not found." : "Source world item not found.");
      return null;
    }

    const itemDocument = isEmbeddedItem
      ? document.items?.get?.(link.itemId)
      : document;

    if (!itemDocument) {
      warn("Source item not found.");
      return null;
    }

    const referencePath = link.referencePath ?? link.path;
    const source = deepClone(getDocumentSource(itemDocument));
    const currentValue = getValueAtPath(source, referencePath);
    if (typeof currentValue !== "string") {
      warn("The stored reference is no longer a string and cannot be updated automatically.");
      return null;
    }

    const nextValue = getFixedStringValue(currentValue, link, {
      replacementUuid: normalizedReplacement,
      clear
    });

    if (nextValue === currentValue) {
      warn("No matching broken compendium UUID was found at that path. Re-run the link check and try again.");
      return null;
    }

    const updatePath = getUpdatePath(referencePath);
    let updateData = isEmbeddedItem ? { _id: link.itemId } : {};

    if (updatePath) updateData[updatePath] = nextValue;
    else {
      if (!setValueAtPath(source, referencePath, nextValue)) {
        warn("Could not update the broken compendium UUID path.");
        return null;
      }

      source._id = link.itemId;
      updateData = source;
      if (!isEmbeddedItem) delete updateData._id;
    }

    if (isEmbeddedItem) await document.updateEmbeddedDocuments("Item", [updateData]);
    else await document.update(updateData);

    const action = clear ? "cleared" : "replaced";
    notifyInfo(`Broken compendium UUID ${action} in ${link.sourceName}.`);
    return {
      sourceScope: "world",
      documentId: link.documentId,
      itemId: link.itemId,
      actorId: link.actorId,
      path: link.pathLabel,
      replacementUuid: normalizedReplacement,
      cleared: clear
    };
  } catch (err) {
    error("Failed to fix broken world item compendium UUID.", err);
    return null;
  }
}

export async function applyBrokenLinkFix(link, { replacementUuid = "", clear = false } = {}) {
  if (!game.user?.isGM) {
    warn("Only the GM can fix compendium links.");
    return null;
  }

  if (link?.sourceScope === "world") return applyWorldBrokenLinkFix(link, { replacementUuid, clear });

  const pack = resolvePack(link?.packId);
  if (!pack) {
    warn("Compendium pack not found.");
    return null;
  }

  const normalizedReplacement = await validateReplacementUuid(replacementUuid, { clear });
  if (normalizedReplacement === null) return null;

  if (!await ensurePackWritable(pack)) return null;

  try {
    const document = await pack.getDocument(link.documentId);
    if (!document) {
      warn("Source item not found.");
      return null;
    }

    const source = deepClone(getDocumentSource(document));
    const currentValue = getValueAtPath(source, link.path);
    if (typeof currentValue !== "string") {
      warn("The stored reference is no longer a string and cannot be updated automatically.");
      return null;
    }

    const nextValue = getFixedStringValue(currentValue, link, {
      replacementUuid: normalizedReplacement,
      clear
    });

    if (nextValue === currentValue) {
      warn("No matching broken compendium UUID was found at that path. Re-run the link check and try again.");
      return null;
    }

    const documentClass = getDocumentClassForPack(pack);
    if (!documentClass?.updateDocuments) throw new Error(`Could not resolve document class for ${pack.documentName ?? "this pack"}.`);

    const updatePath = getUpdatePath(link.path);
    let updateData = { _id: link.documentId };

    if (updatePath) updateData[updatePath] = nextValue;
    else {
      if (!setValueAtPath(source, link.path, nextValue)) {
        warn("Could not update the broken compendium UUID path.");
        return null;
      }

      source._id = link.documentId;
      updateData = source;
    }

    await documentClass.updateDocuments([updateData], { pack: pack.collection });
    resetCompendiumIndexCache(pack);
    pack.render?.(false);
    ui.compendium?.render?.(false);

    const action = clear ? "cleared" : "replaced";
    notifyInfo(`Broken compendium UUID ${action} in ${link.sourceName}.`);
    return {
      packId: pack.collection,
      documentId: link.documentId,
      path: link.pathLabel,
      replacementUuid: normalizedReplacement,
      cleared: clear
    };
  } catch (err) {
    error("Failed to fix broken compendium UUID.", err);
    return null;
  }
}

export function getBrokenLinkFixDialogContent(link) {
  const assignedActor = link.actorName
    ? `${link.actorName}${link.actorType ? ` (${link.actorType})` : ""}`
    : "None - standalone item";
  const sourceLabel = link.sourceScope === "world" ? "Source" : "Pack";

  return `
    <form class="mkcm-broken-link-form">
      <p><strong>Item:</strong> ${escapeHtml(link.itemName ?? link.sourceName)}${link.itemType ? ` (${escapeHtml(link.itemType)})` : ""}</p>
      <p><strong>Assigned Actor:</strong> ${escapeHtml(assignedActor)}</p>
      <p><strong>${sourceLabel}:</strong> ${escapeHtml(link.packTitle)}</p>
      <p><strong>Source UUID:</strong> <code>${escapeHtml(link.sourceUuid)}</code></p>
      <p><strong>Field:</strong> <code>${escapeHtml(link.pathLabel)}</code></p>
      <p><strong>Broken compendium UUID:</strong> <code>${escapeHtml(link.normalizedUuid)}</code></p>
      <div class="form-group">
        <label>Replacement compendium UUID</label>
        <input type="text" name="replacementUuid" value="" placeholder="Compendium.package.pack.documentId" autocomplete="off" />
      </div>
      <p class="notes">Replace validates that the target exists in a compendium before updating the item. Clear removes this broken link from the field.</p>
    </form>
  `;
}

export async function openBrokenLinkFixDialog(link) {
  if (!link) return null;

  const DialogClass = globalThis.Dialog;
  if (!DialogClass) {
    warn("The Foundry dialog API is not available.");
    return null;
  }

  return new Promise(resolve => {
    new DialogClass({
      title: "Fix Broken Compendium UUID",
      content: getBrokenLinkFixDialogContent(link),
      buttons: {
        replace: {
          icon: '<i class="fas fa-wrench"></i>',
          label: "Replace",
          callback: async html => {
            const root = html?.[0] ?? html;
            const form = root?.querySelector?.("form") ?? root;
            const replacementUuid = form?.querySelector?.('[name="replacementUuid"]')?.value ?? "";
            resolve(await applyBrokenLinkFix(link, { replacementUuid }));
          }
        },
        clear: {
          icon: '<i class="fas fa-eraser"></i>',
          label: "Clear Link",
          callback: async () => {
            resolve(await applyBrokenLinkFix(link, { clear: true }));
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null)
        }
      },
      default: "replace",
      close: () => resolve(null)
    }).render(true);
  });
}

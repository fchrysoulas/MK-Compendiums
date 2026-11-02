import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = {
  utils: {
    deepClone: value => JSON.parse(JSON.stringify(value)),
    randomID: (() => {
      let nextId = 0;
      return () => {
        nextId += 1;
        return `generated${String(nextId).padStart(7, "0")}`;
      };
    })()
  }
};

globalThis.game = {
  packs: new Map()
};

const utils = await import("../scripts/utils.js");
const importer = await import("../scripts/importer.js");

test("normalizeImportPayload accepts supported pack export shapes", () => {
  const payload = utils.normalizeImportPayload({
    schema: "mk-compendiums.v1",
    pack: { documentName: "Item" },
    folders: [{ _id: "folder1" }],
    entries: [{ _id: "entry1", name: "Entry" }]
  });

  assert.equal(payload.schema, "mk-compendiums.v1");
  assert.equal(payload.pack.documentName, "Item");
  assert.deepEqual(payload.folders, [{ _id: "folder1" }]);
  assert.deepEqual(payload.entries, [{ _id: "entry1", name: "Entry" }]);
});

test("rewriteDocumentReferences rewrites exact IDs and UUID references without touching prose", () => {
  const oldId = "abcdefghijklmnop";
  const newId = "qrstuvwxyzABCDEF";
  const rewritten = utils.rewriteDocumentReferences({
    system: {
      description: `Do not rewrite ${oldId} in ordinary prose.`,
      sourceId: `Compendium.world.pack.${oldId}`,
      references: [
        oldId,
        `@UUID[Compendium.world.pack.${oldId}]{Linked Entry}`
      ],
      compact: `prefix${oldId}suffix`
    },
    flags: {
      [oldId]: true
    }
  }, new Map([[oldId, newId]]));

  assert.equal(rewritten.system.description, `Do not rewrite ${oldId} in ordinary prose.`);
  assert.equal(rewritten.system.sourceId, `Compendium.world.pack.${newId}`);
  assert.deepEqual(rewritten.system.references, [
    newId,
    `@UUID[Compendium.world.pack.${newId}]{Linked Entry}`
  ]);
  assert.equal(rewritten.system.compact, `prefix${oldId}suffix`);
  assert.deepEqual(rewritten.flags, { [newId]: true });
});

test("prepareFolderQueue orders parents before children", () => {
  const pack = { documentName: "Item", collection: "world.items" };
  const folders = [
    { _id: "child", name: "Child", folder: "root" },
    { _id: "root", name: "Root", folder: null }
  ];

  const queue = importer.prepareFolderQueue(folders, pack);

  assert.deepEqual(queue.map(folder => folder.oldId), ["root", "child"]);
  assert.equal(queue[0].data.type, "Item");
  assert.equal(queue[1].parentOldId, "root");
});

test("rewriteEntryFolderReference places folderless imports under the target folder", () => {
  const rewritten = importer.rewriteEntryFolderReference(
    { _id: "entry1", folder: null },
    new Map(),
    { preserveFolders: true, targetFolderId: "target-folder" }
  );

  assert.equal(rewritten.folder, "target-folder");
});

test("findTargetPackForExportBlock matches by exported name and document type", () => {
  const pack = {
    collection: "world.spells",
    documentName: "Item",
    metadata: {
      name: "spells",
      label: "Spells",
      package: "world"
    }
  };

  globalThis.game.packs = new Map([["world.spells", pack]]);

  const match = utils.findTargetPackForExportBlock({
    pack: {
      documentName: "Item",
      name: "spells"
    }
  }, ["world.spells"]);

  assert.equal(match, pack);
});

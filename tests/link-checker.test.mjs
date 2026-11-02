import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyBrokenLinkFix,
  findBrokenLinksInPacks,
  findBrokenLinksInWorld,
  findUuidReferencesInSource
} from "../scripts/link-checker.js";

const VALID_UUID = "Compendium.world.targets.abcdefghijklmnop";
const MISSING_UUID = "Compendium.world.targets.missingmissing00";

beforeEach(() => {
  globalThis.foundry = { utils: { deepClone: structuredClone } };
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.game = {
    user: { isGM: true },
    packs: new Map([["world.targets", {
      collection: "world.targets",
      documentName: "Item",
      getIndex: async () => [{ _id: "abcdefghijklmnop" }]
    }]]),
    items: new Map(),
    actors: new Map(),
    folders: new Map()
  };
});

test("leading inline links are extracted once without treating prose as a UUID", () => {
  for (const link of [`@UUID[${MISSING_UUID}]{Broken}`, "@Compendium[world.targets.missingmissing00]{Broken}"]) {
    const text = `${link} plus prose and @UUID[${VALID_UUID}]{Valid}.`;
    const references = findUuidReferencesInSource({ description: text });
    assert.equal(references.length, 2);
    assert.ok(references.every(reference => reference.syntax !== "direct"));
    assert.deepEqual(references.map(reference => reference.normalizedUuid).sort(), [VALID_UUID, MISSING_UUID].sort());
  }
});

test("direct UUIDs followed by prose or punctuation produce only the UUID token", async () => {
  const text = `${VALID_UUID} is a valid target.`;
  const references = findUuidReferencesInSource({ description: text });
  assert.equal(references.length, 1);
  assert.equal(references[0].rawUuid, VALID_UUID);
  for (const value of [VALID_UUID, `  ${VALID_UUID}  `, `${VALID_UUID}.`]) {
    assert.equal(findUuidReferencesInSource({ value }).length, 1);
  }
  game.items.set("source", { _id: "source", system: { description: text } });
  assert.deepEqual(await findBrokenLinksInWorld({ includeActors: false }), []);
});

test("bare legacy compendium UUID fields are still recognized", () => {
  const references = findUuidReferencesInSource({ value: "  world.targets.missingmissing00  " });
  assert.equal(references.length, 1);
  assert.equal(references[0].normalizedUuid, MISSING_UUID);
});

test("clearing or replacing a leading broken link preserves prose and valid links", async () => {
  for (const clear of [true, false]) {
    const suffix = ` plus keep this prose and @UUID[${VALID_UUID}]{Valid}.`;
    const source = { _id: "source", name: "Example", system: { description: `@UUID[${MISSING_UUID}]{Broken}${suffix}` } };
    game.items.set(source._id, {
      toObject: () => structuredClone(source),
      update: async update => { source.system.description = update["system.description"]; }
    });
    const links = await findBrokenLinksInWorld({ includeActors: false });
    assert.equal(links.length, 1);
    assert.ok(await applyBrokenLinkFix(links[0], { clear, replacementUuid: VALID_UUID }));
    assert.equal(source.system.description, clear ? `Broken${suffix}` : `@UUID[${VALID_UUID}]{Broken}${suffix}`);
  }
});

function addActorPack(system = { description: MISSING_UUID }) {
  const source = {
    _id: "actor",
    name: "Actor",
    items: [
      { _id: "itemA", name: "Item A", system: structuredClone(system) },
      { _id: "itemB", name: "Item B", system: structuredClone(system) }
    ]
  };
  const updates = [];
  const actor = {
    toObject: () => structuredClone(source),
    items: { get: id => {
      const item = source.items.find(item => item._id === id);
      return item ? { toObject: () => structuredClone(item) } : null;
    } },
    updateEmbeddedDocuments: async (type, data) => {
      assert.equal(type, "Item");
      updates.push(...data);
      return data;
    }
  };
  const pack = {
    collection: "world.actors",
    documentName: "Actor",
    getIndex: async () => [structuredClone(source)],
    getDocument: async id => id === source._id ? actor : null,
    documentClass: { updateDocuments: () => assert.fail("Actor items must use embedded updates") }
  };
  game.packs.set(pack.collection, pack);
  return { pack, source, actor, updates };
}

test("compendium actor repairs target the saved item ID after inventory order changes", async () => {
  const { pack, source, updates } = addActorPack();
  const links = await findBrokenLinksInPacks([pack]);
  const link = links.find(link => link.itemId === "itemA");
  source.items.reverse();

  assert.ok(await applyBrokenLinkFix(link, { clear: true }));
  assert.deepEqual(updates, [{ _id: "itemA", "system.description": "" }]);
});

test("compendium repairs reject a removed item or an already changed reference", async () => {
  const { pack, source, updates } = addActorPack();
  const link = (await findBrokenLinksInPacks([pack])).find(link => link.itemId === "itemA");
  const removedItem = source.items.shift();
  assert.equal(await applyBrokenLinkFix(link, { clear: true }), null);
  removedItem.system.description = VALID_UUID;
  source.items.push(removedItem);
  assert.equal(await applyBrokenLinkFix(link, { clear: true }), null);
  assert.deepEqual(updates, []);
});

test("repairs send complete nested arrays and preserve sibling values", async () => {
  const { pack, updates } = addActorPack({ references: [MISSING_UUID, VALID_UUID], other: "Keep" });
  const link = (await findBrokenLinksInPacks([pack])).find(link => link.itemId === "itemA");
  assert.ok(await applyBrokenLinkFix(link, { replacementUuid: VALID_UUID }));
  assert.deepEqual(updates, [{ _id: "itemA", "system.references": [VALID_UUID, VALID_UUID] }]);
});

test("dotted reference keys fall back to updating only the identified item", async () => {
  const { pack, source, updates } = addActorPack({ "origin.uuid": MISSING_UUID, other: "Keep" });
  const link = (await findBrokenLinksInPacks([pack])).find(link => link.itemId === "itemA");
  source.items.reverse();
  assert.ok(await applyBrokenLinkFix(link, { clear: true }));
  assert.deepEqual(updates, [{ _id: "itemA", name: "Item A", system: { "origin.uuid": "", other: "Keep" } }]);
});

test("world actor repairs retain item IDs and use complete array updates", async () => {
  const { actor, updates } = addActorPack({ references: [MISSING_UUID, VALID_UUID] });
  game.actors.set("actor", actor);
  const link = (await findBrokenLinksInWorld({ includeItems: false })).find(link => link.itemId === "itemA");
  assert.ok(await applyBrokenLinkFix(link, { clear: true }));
  assert.deepEqual(updates, [{ _id: "itemA", "system.references": ["", VALID_UUID] }]);
});

test("standalone compendium repairs keep the document and pack IDs", async () => {
  const source = { _id: "standalone", name: "Standalone", system: { reference: MISSING_UUID } };
  const updates = [];
  const pack = {
    collection: "world.sources",
    documentName: "Item",
    getIndex: async () => [structuredClone(source)],
    getDocument: async () => ({ toObject: () => structuredClone(source) }),
    documentClass: { updateDocuments: async (data, options) => { updates.push({ data, options }); return data; } }
  };
  game.packs.set(pack.collection, pack);
  const [link] = await findBrokenLinksInPacks([pack]);
  assert.ok(await applyBrokenLinkFix(link, { clear: true }));
  assert.deepEqual(updates, [{ data: [{ _id: "standalone", "system.reference": "" }], options: { pack: "world.sources" } }]);
});

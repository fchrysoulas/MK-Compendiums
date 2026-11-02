import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { importPackFromPayload } from "../scripts/importer.js";
import { rewriteCompendiumReferences } from "../scripts/utils.js";

const ITEM_A = "originalitem00001";
const ITEM_B = "originalitem00002";

beforeEach(() => {
  let nextId = 0;
  globalThis.foundry = { utils: { deepClone: structuredClone, randomID: () => `generated${String(++nextId).padStart(7, "0")}` } };
  globalThis.CONFIG = {};
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.game = { user: { isGM: true }, packs: new Map() };
});

function addPack(collection = "world.destination") {
  const sources = [];
  class ItemDocument {
    constructor(source) { this.source = source; }
    static async createDocuments(data) { sources.push(...structuredClone(data)); return data; }
    static async updateDocuments(data) {
      for (const entry of data) Object.assign(sources.find(source => source._id === entry._id), structuredClone(entry));
      return data;
    }
  }
  const pack = {
    collection,
    title: "Destination",
    documentName: "Item",
    metadata: { packageType: "world", packageName: "world" },
    folders: [],
    getIndex: async () => structuredClone(sources),
    getDocuments: async () => structuredClone(sources),
    documentClass: ItemDocument
  };
  game.packs.set(collection, pack);
  return { pack, sources };
}

function payload(system) {
  return { pack: { id: "world.original", documentName: "Item" }, entries: [
    { _id: ITEM_A, name: "A", system },
    { _id: ITEM_B, name: "B", system: {} }
  ] };
}

test("single-pack create-new imports remap internal UUIDs to the destination", async () => {
  const { pack, sources } = addPack();
  const result = await importPackFromPayload(pack, payload({
    description: `@UUID[Compendium.world.original.${ITEM_B}]{B}`,
    legacy: `@Compendium[world.original.${ITEM_B}]{B}`,
    typed: `Compendium.world.original.Item.${ITEM_B}.ActiveEffect.effectId`,
    reference: ITEM_B,
    keyed: { [`Compendium.world.original.${ITEM_B}`]: true }
  }), { mode: "new", preserveFolders: false });

  assert.equal(result.created, 2);
  const newB = sources[1]._id;
  assert.notEqual(newB, ITEM_B);
  assert.equal(sources[0].system.description, `@UUID[Compendium.world.destination.${newB}]{B}`);
  assert.equal(sources[0].system.legacy, `@Compendium[world.destination.${newB}]{B}`);
  assert.equal(sources[0].system.typed, `Compendium.world.destination.Item.${newB}.ActiveEffect.effectId`);
  assert.equal(sources[0].system.reference, newB);
  assert.deepEqual(sources[0].system.keyed, { [`Compendium.world.destination.${newB}`]: true });
});

test("single-pack upserts retarget the pack while preserving document IDs", async () => {
  const { pack, sources } = addPack();
  const result = await importPackFromPayload(pack, payload({ reference: `Compendium.world.original.${ITEM_B}` }), { preserveFolders: false });
  assert.equal(result.created, 2);
  assert.equal(sources[1]._id, ITEM_B);
  assert.equal(sources[0].system.reference, `Compendium.world.destination.${ITEM_B}`);
});

test("partial imports leave external targets unchanged even when IDs collide", async () => {
  const { pack, sources } = addPack();
  const external = `@UUID[Compendium.world.external.${ITEM_B}]{External}`;
  const nonImported = "Compendium.world.original.notimported00001";
  await importPackFromPayload(pack, payload({ external, nonImported, legacyExternal: `@Compendium[world.external.${ITEM_B}]{External}` }), { mode: "new", preserveFolders: false });
  assert.equal(sources[0].system.external, external);
  assert.equal(sources[0].system.nonImported, nonImported);
  assert.equal(sources[0].system.legacyExternal, `@Compendium[world.external.${ITEM_B}]{External}`);
});

test("same-pack create-new imports point to the newly duplicated documents", async () => {
  const { pack, sources } = addPack("world.original");
  await importPackFromPayload(pack, payload({ reference: `Compendium.world.original.${ITEM_B}` }), { mode: "new", preserveFolders: false });
  assert.equal(sources[0].system.reference, `Compendium.world.original.${sources[1]._id}`);
});

test("imports preserve supplied directory plans and colliding cross-pack IDs", async () => {
  const { pack, sources } = addPack();
  const documentIdMap = new Map([[ITEM_A, "newA"], [ITEM_B, "newB"]]);
  const referencePlan = [
    { sourcePackId: "world.original", targetPackId: pack.collection, documentName: "Item", documentIdMap },
    { sourcePackId: "world.external", targetPackId: "world.external-copy", documentName: "Item", documentIdMap: new Map([[ITEM_B, "externalB"]]) }
  ];
  await importPackFromPayload(pack, payload({ reference: `Compendium.world.external.${ITEM_B}` }), { mode: "new", preserveFolders: false, referencePlan, documentIdMap });
  assert.equal(sources[1]._id, "newB");
  assert.equal(sources[0].system.reference, "Compendium.world.external-copy.externalB");
});

test("reference plans do not cascade through another plan's source pack", () => {
  const referencePlan = [
    { sourcePackId: "world.a", targetPackId: "world.b", documentIdMap: new Map([["item", "item"]]) },
    { sourcePackId: "world.b", targetPackId: "world.c", documentIdMap: new Map([["item", "item"]]) }
  ];
  assert.equal(rewriteCompendiumReferences("@UUID[Compendium.world.a.item]{A} @Compendium[world.b.item]{B}", referencePlan),
    "@UUID[Compendium.world.b.item]{A} @Compendium[world.c.item]{B}");
});

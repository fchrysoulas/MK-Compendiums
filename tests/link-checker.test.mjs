import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  applyBrokenLinkFix,
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

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { importPackFromPayload } from "../scripts/importer.js";

class ApplicationV2 {
  rendered = false;
  renders = 0;
  render() { this.rendered = true; this.renders += 1; return Promise.resolve(this); }
}
globalThis.foundry = { applications: { api: { ApplicationV2 } } };
const { MkCompendiumBrowser, openCompendiumBrowser } = await import("../scripts/browser.js");
const { registerCompendiumContextMenu } = await import("../scripts/hooks.js");

let pendingHooks;
beforeEach(() => {
  globalThis.foundry = { utils: { deepClone: structuredClone }, applications: { api: { ApplicationV2 } } };
  globalThis.CONFIG = {};
  globalThis.ui = { notifications: { info() {}, warn() {}, error() {} } };
  globalThis.game = { user: { isGM: true }, packs: new Map(), items: new Map(), actors: new Map(), folders: new Map() };
  const handlers = new Map();
  pendingHooks = [];
  globalThis.Hooks = {
    on(name, callback) { handlers.set(name, [...(handlers.get(name) ?? []), callback]); },
    callAll(name, ...args) {
      for (const callback of handlers.get(name) ?? []) pendingHooks.push(Promise.resolve(callback(...args)));
    }
  };
  registerCompendiumContextMenu();
});

function addPack(collection = "world.items") {
  const sources = [{ _id: "initial", name: "Initial", type: "weapon", system: { description: "Original description" } }];
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
    title: collection,
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

function openBrowser(pack) {
  const browser = openCompendiumBrowser({ packId: pack.collection, folderId: "" });
  browser.indexCache.clear();
  browser._indexCacheVersions.clear();
  Object.assign(browser.browserState, {
    query: "", entryType: "", documentName: "", packageName: "",
    searched: false, loading: false, linkAuditActive: false, results: [], linkResults: []
  });
  return browser;
}

test("API imports refresh active results and invalidate basic and deep caches", async () => {
  const { pack } = addPack();
  const browser = openBrowser(pack);
  await browser.runSearch({ render: false });
  browser.browserState.query = "Original";
  await browser.runSearch({ render: false });
  browser.browserState.query = "";
  const renders = browser.renders;

  assert.equal((await importPackFromPayload(pack, { entries: [
    { _id: "added", name: "Added", type: "spell", system: { description: "New description" } }
  ] }, { mode: "add", preserveFolders: false })).created, 1);
  await Promise.all(pendingHooks);

  assert.deepEqual(browser.browserState.results.map(entry => entry.id).sort(), ["added", "initial"]);
  assert.deepEqual(browser.browserState.availableEntryTypes, ["spell", "weapon"]);
  assert.ok(browser.renders > renders);
  browser.browserState.query = "New description";
  await browser.runSearch({ render: false });
  assert.deepEqual(browser.browserState.results.map(entry => entry.id), ["added"]);
});

test("imports update cached state without reopening a closed browser", async () => {
  const { pack } = addPack();
  const browser = openBrowser(pack);
  await browser.runSearch({ render: false });
  browser.rendered = false;
  const renders = browser.renders;
  await importPackFromPayload(pack, { entries: [{ _id: "added", name: "Added" }] }, { mode: "add", preserveFolders: false });
  await Promise.all(pendingHooks);
  assert.equal(browser.browserState.results.length, 2);
  assert.equal(browser.renders, renders);
  assert.equal(browser.rendered, false);
});

test("imports into another pack invalidate its cache without replacing the active view", async () => {
  const { pack } = addPack();
  const { pack: otherPack } = addPack("world.other");
  const browser = openBrowser(pack);
  await browser.getIndexForPack(otherPack);
  await browser.runSearch({ render: false });
  const renders = browser.renders;
  await importPackFromPayload(otherPack, { entries: [{ _id: "added", name: "Added" }] }, { mode: "add", preserveFolders: false });
  await Promise.all(pendingHooks);
  assert.deepEqual(browser.browserState.results.map(entry => entry.id), ["initial"]);
  assert.equal(browser.renders, renders);
  assert.equal((await browser.getIndexForPack(otherPack)).length, 2);
});

test("a pre-import index response cannot overwrite refreshed results or caches", async () => {
  const { pack, sources } = addPack();
  const browser = new MkCompendiumBrowser({ packId: pack.collection });
  let finishOldIndex;
  const oldSources = structuredClone(sources);
  let firstRequest = true;
  pack.getIndex = () => {
    if (!firstRequest) return Promise.resolve(structuredClone(sources));
    firstRequest = false;
    return new Promise(resolve => { finishOldIndex = () => resolve(oldSources); });
  };
  const oldSearch = browser.runSearch({ render: false });
  sources.push({ _id: "added", name: "Added" });
  await browser.refreshAfterPackImport(pack);
  finishOldIndex();
  await oldSearch;
  assert.equal(browser.browserState.results.length, 2);
  assert.equal((await browser.getIndexForPack(pack)).length, 2);
});

test("imports refresh active broken-link audits", async () => {
  const { pack, sources } = addPack();
  sources[0].system.reference = "Compendium.world.items.added";
  const browser = openBrowser(pack);
  await browser.runBrokenLinkCheck({ render: false });
  assert.equal(browser.browserState.linkResults.length, 1);
  await importPackFromPayload(pack, { entries: [{ _id: "added", name: "Added" }] }, { mode: "add", preserveFolders: false });
  await Promise.all(pendingHooks);
  assert.equal(browser.browserState.linkAuditActive, true);
  assert.deepEqual(browser.browserState.linkResults, []);
});

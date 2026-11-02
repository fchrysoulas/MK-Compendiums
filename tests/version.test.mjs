import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getModuleVersion } from "../scripts/constants.js";

test("getModuleVersion reads the installed manifest version", async t => {
  const manifest = JSON.parse(await readFile(new URL("../module.json", import.meta.url), "utf8"));
  const previousGame = globalThis.game;
  t.after(() => { globalThis.game = previousGame; });
  globalThis.game = { modules: new Map([[manifest.id, { version: manifest.version }]]) };

  assert.equal(getModuleVersion(), manifest.version);
});

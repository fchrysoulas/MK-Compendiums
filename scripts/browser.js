import {
  collectPackFolderTree,
  documentIdOf,
  error,
  escapeHtml,
  getBrowserFolderRows,
  getBrowserPackIndex,
  getBrowserPackMeta,
  getDocumentDescriptionSearchText,
  getDocumentSource,
  getExportablePacks,
  getFolderPathForBrowser,
  getPackPackageName,
  getPackTitle,
  normalizeFolderReference,
  readBrowserStateFromForm,
  resolvePack,
  warn
} from './utils.js';
import { confirmExportAction, exportPackToJson } from './exporter.js';
import { openImportDialog } from './importer.js';
import { MODULE_VERSION } from './constants.js';

const BROWSER_WINDOW_TITLE = `MK Compendium Browser v${MODULE_VERSION}`;
const FoundryApplicationV2 = foundry.applications?.api?.ApplicationV2;

if (!FoundryApplicationV2) {
  throw new Error("MK-Compendiums requires Foundry VTT v12+ with ApplicationV2 support.");
}

export class MkCompendiumBrowser extends FoundryApplicationV2 {
  /**
   * ApplicationV2 options used by both Foundry v12 and v13.
   */
  static DEFAULT_OPTIONS = {
    id: "mk-compendiums-browser",
    classes: ["mk-compendiums-browser"],
    window: {
      title: BROWSER_WINDOW_TITLE,
      icon: "fa-solid fa-book",
      resizable: true
    },
    position: {
      width: 980,
      height: 720
    }
  };

  constructor(options = {}) {
    super(options);
    this._browserState = {
      query: "",
      documentName: "",
      entryType: "",
      packageName: "",
      packId: options.packId ?? "",
      folderId: options.folderId ?? "",
      results: [],
      searched: false,
      loading: false,
      message: "Select a pack to browse, or search across all compendiums."
    };
    this.indexCache = new Map();
    this.descriptionSearchCache = new Map();
    this._searchTimeout = null;
    this._searchRequest = 0;
    this._sidebarScrollTop = 0;
    this._listenerController = null;
    this._busyActions = new Set();
  }

  /**
   * Mutable browser UI state. Do not use the name "state" here: in
   * Foundry v13 ApplicationV2, state is a read-only render-state getter.
   */
  get browserState() {
    return this._browserState;
  }

  get title() {
    return BROWSER_WINDOW_TITLE;
  }

  /**
   * ApplicationV2 render hook used by both Foundry v12 and v13.
   */
  async _renderHTML(_context, _options) {
    return this.buildHtml();
  }

  /**
   * ApplicationV2 HTML replacement hook used by both Foundry v12 and v13.
   */
  _getRenderContentElement(content) {
    if (content instanceof Element) return content;
    if (Array.isArray(content) && content[0] instanceof Element) return content[0];
    if (content?.[0] instanceof Element) return content[0];
    if (content?.element instanceof Element) return content.element;
    if (content?.element?.[0] instanceof Element) return content.element[0];
    if (this.element instanceof Element) return this.element;
    if (this.element?.[0] instanceof Element) return this.element[0];
    return null;
  }

  /**
   * ApplicationV2 HTML replacement hook used by both Foundry v12 and v13.
   * Foundry may pass either a DOM element, a jQuery object, or the
   * ApplicationV2 content wrapper depending on the render path. Normalize it
   * before replacing HTML so we do not call DOM methods on a wrapper object.
   */
  _replaceHTML(result, content, _options) {
    const html = typeof result === "string" ? result : String(result ?? "");
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    const target = this._getRenderContentElement(content);

    if (!target) {
      error("Could not resolve MK Compendium Browser render target.");
      return;
    }

    const nodes = Array.from(template.content.childNodes);
    if (typeof target.replaceChildren === "function") target.replaceChildren(...nodes);
    else {
      while (target.firstChild) target.removeChild(target.firstChild);
      for (const node of nodes) target.appendChild(node);
    }

    this.activateBrowserListeners(target);
  }

  get packs() {
    return getExportablePacks();
  }

  get selectedPack() {
    return this.browserState.packId ? resolvePack(this.browserState.packId) : null;
  }

  get packMetas() {
    return this.packs.map(getBrowserPackMeta);
  }

  get filteredPackMetas() {
    return this.packMetas.filter(pack => {
      if (this.browserState.documentName && pack.documentName !== this.browserState.documentName) return false;
      if (this.browserState.packageName && pack.packageName !== this.browserState.packageName) return false;
      return true;
    });
  }

  get documentNames() {
    return Array.from(new Set(this.packMetas.map(pack => pack.documentName).filter(Boolean))).sort();
  }

  get packageNames() {
    return Array.from(new Set(this.packMetas.map(pack => pack.packageName).filter(Boolean))).sort();
  }

  get entryTypes() {
    const types = new Set();
    for (const entry of this.browserState.results ?? []) if (entry.type) types.add(entry.type);
    return Array.from(types).sort();
  }

  async getIndexForPack(pack, { force = false } = {}) {
    const packId = pack.collection ?? pack.metadata?.id ?? pack.metadata?.name;
    if (!packId) return [];
    if (force) this.indexCache.delete(packId);
    if (!this.indexCache.has(packId)) this.indexCache.set(packId, await getBrowserPackIndex(pack, { force }));
    return this.indexCache.get(packId) ?? [];
  }


  async getDescriptionSearchIndexForPack(pack, { force = false } = {}) {
    const packId = pack.collection ?? pack.metadata?.id ?? pack.metadata?.name;
    if (!packId) return new Map();
    if (force) this.descriptionSearchCache.delete(packId);

    if (!this.descriptionSearchCache.has(packId)) {
      const descriptionIndex = new Map();

      try {
        const documents = await pack.getDocuments();
        for (const document of documents) {
          const source = getDocumentSource(document);
          const id = documentIdOf(source) ?? documentIdOf(document);
          if (!id) continue;

          const text = getDocumentDescriptionSearchText(source).toLocaleLowerCase();
          if (text) descriptionIndex.set(id, text);
        }
      } catch (err) {
        warn(`Could not load full documents for description search in "${getPackTitle(pack)}".`);
        console.warn(err);
      }

      this.descriptionSearchCache.set(packId, descriptionIndex);
    }

    return this.descriptionSearchCache.get(packId) ?? new Map();
  }

  getCandidatePacks() {
    let packs = this.packs;
    if (this.browserState.packId) packs = packs.filter(pack => (pack.collection ?? pack.metadata?.id ?? pack.metadata?.name) === this.browserState.packId);
    if (this.browserState.documentName) packs = packs.filter(pack => (pack.documentName ?? pack.metadata?.type) === this.browserState.documentName);
    if (this.browserState.packageName) packs = packs.filter(pack => getPackPackageName(pack) === this.browserState.packageName);
    return packs;
  }

  async runSearch({ render = true, force = false } = {}) {
    const requestId = ++this._searchRequest;
    this.browserState.loading = true;
    this.browserState.searched = true;

    try {
      const query = (this.browserState.query ?? "").toLocaleLowerCase();
      const results = [];

      for (const pack of this.getCandidatePacks()) {
        const entries = await this.getIndexForPack(pack, { force });
        const descriptionSearchIndex = query ? await this.getDescriptionSearchIndexForPack(pack, { force }) : null;
        const folderFilter = this.browserState.packId && this.browserState.folderId ? collectPackFolderTree(pack, this.browserState.folderId) : null;

        for (const entry of entries) {
          if (this.browserState.entryType && entry.type !== this.browserState.entryType) continue;
          if (folderFilter && !folderFilter.has(normalizeFolderReference(entry.folder))) continue;
          if (query) {
            const haystack = `${entry.name} ${entry.type} ${entry.packTitle} ${entry.packageName} ${getFolderPathForBrowser(pack, entry.folder)}`.toLocaleLowerCase();
            const descriptionHaystack = descriptionSearchIndex?.get(entry.id) ?? "";
            if (!haystack.includes(query) && !descriptionHaystack.includes(query)) continue;
          }

          results.push({
            ...entry,
            folderPath: getFolderPathForBrowser(pack, entry.folder)
          });
        }
      }

      if (requestId !== this._searchRequest) return;

      results.sort((a, b) => a.name.localeCompare(b.name) || a.packTitle.localeCompare(b.packTitle));
      this.browserState.results = results;
      this.browserState.message = results.length ? `${results.length} result(s).` : "No matching compendium entries found.";
    } catch (err) {
      if (requestId !== this._searchRequest) return;
      this.browserState.results = [];
      this.browserState.message = "Search failed. Check the console for details.";
      error("Compendium browser search failed.", err);
    } finally {
      if (requestId === this._searchRequest) {
        this.browserState.loading = false;
        if (render) this.render(true);
      }
    }
  }

  captureSidebarScroll(root) {
    const sidebar = root?.querySelector?.(".mkcm-browser-sidebar");
    if (sidebar) this._sidebarScrollTop = sidebar.scrollTop ?? 0;
  }

  restoreSidebarScroll(root, listenerOptions = {}) {
    const sidebar = root?.querySelector?.(".mkcm-browser-sidebar");
    if (!sidebar) return;

    sidebar.scrollTop = this._sidebarScrollTop ?? 0;
    sidebar.addEventListener("scroll", () => {
      this._sidebarScrollTop = sidebar.scrollTop ?? 0;
    }, listenerOptions);
  }

  resetFiltersAndResults() {
    this.browserState.query = "";
    this.browserState.documentName = "";
    this.browserState.entryType = "";
    this.browserState.packageName = "";
    this.browserState.packId = "";
    this.browserState.folderId = "";
    this.browserState.results = [];
    this.browserState.searched = false;
    this.browserState.loading = false;
    this.browserState.message = "Select a pack to browse, or search across all compendiums.";
  }

  async refreshBrowser() {
    this.indexCache.clear();
    this.descriptionSearchCache.clear();
    this._sidebarScrollTop = 0;
    this.resetFiltersAndResults();
    await this.runSearch({ force: true });
  }

  buildFiltersHtml() {
    const documentOptions = this.documentNames.map(name => `<option value="${escapeHtml(name)}" ${this.browserState.documentName === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
    const packageOptions = this.packageNames.map(name => `<option value="${escapeHtml(name)}" ${this.browserState.packageName === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
    const packOptions = this.filteredPackMetas.map(pack => `<option value="${escapeHtml(pack.id)}" ${this.browserState.packId === pack.id ? "selected" : ""}>${escapeHtml(pack.title)}</option>`).join("");
    const entryTypeOptions = this.entryTypes.map(name => `<option value="${escapeHtml(name)}" ${this.browserState.entryType === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");

    return `
      <form class="mkcm-browser-filters">
        <div class="mkcm-browser-search-row">
          <input type="search" name="query" value="${escapeHtml(this.browserState.query)}" placeholder="Search names, descriptions, packs, folders..." autocomplete="off" />
          <button type="button" data-action="search"><i class="fas fa-search"></i> Search</button>
          <button type="button" data-action="refresh"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        <div class="mkcm-browser-filter-row">
          <label>Document
            <select name="documentName">
              <option value="">All</option>
              ${documentOptions}
            </select>
          </label>
          <label>Entry Type
            <select name="entryType">
              <option value="">All loaded</option>
              ${entryTypeOptions}
            </select>
          </label>
          <label>Package
            <select name="packageName">
              <option value="">All</option>
              ${packageOptions}
            </select>
          </label>
          <label>Pack
            <select name="packId">
              <option value="">All matching packs</option>
              ${packOptions}
            </select>
          </label>
        </div>
      </form>
    `;
  }

  buildPackFolderTreeHtml(packMeta) {
    if (!packMeta?.id || this.browserState.packId !== packMeta.id) return "";

    const pack = resolvePack(packMeta.id);
    if (!pack) return "";

    const rows = getBrowserFolderRows(pack);
    if (!rows.length) {
      return '<div class="mkcm-pack-folder-tree"><div class="mkcm-empty mkcm-tree-empty">No internal folders.</div></div>';
    }

    return `
      <div class="mkcm-pack-folder-tree" data-pack-id="${escapeHtml(packMeta.id)}">
        ${rows.map(folder => `
          <div class="mkcm-folder-row-wrap ${this.browserState.folderId === folder.id ? "active" : ""}" data-pack-id="${escapeHtml(packMeta.id)}" data-folder-id="${escapeHtml(folder.id)}" style="--mkcm-folder-depth:${folder.depth};${folder.color ? `--mkcm-folder-color:${escapeHtml(folder.color)};` : ""}">
            <button type="button" class="mkcm-folder-main" data-action="select-folder" title="Browse this folder">
              <span><i class="fas fa-folder mkcm-folder-icon"></i> ${escapeHtml(folder.name)}</span>
            </button>
          </div>
        `).join("")}
      </div>
    `;
  }

  buildPackListHtml() {
    const packs = this.filteredPackMetas;
    if (!packs.length) return '<div class="mkcm-empty">No matching compendium packs.</div>';

    const canManageCompendiums = game.user?.isGM ?? false;

    return packs.map(pack => `
      <div class="mkcm-pack-block ${this.browserState.packId === pack.id ? "active" : ""}" data-pack-id="${escapeHtml(pack.id)}">
        <div class="mkcm-pack-row ${this.browserState.packId === pack.id && !this.browserState.folderId ? "active" : ""}">
          <button type="button" class="mkcm-pack-main" data-action="select-pack" title="Browse this pack">
            <span class="mkcm-pack-title"><i class="fas fa-book"></i> ${escapeHtml(pack.title)}</span>
            <span class="mkcm-pack-meta">${escapeHtml(pack.documentName)} · ${escapeHtml(pack.packageName)}${pack.locked ? " · locked" : ""}</span>
          </button>
          <div class="mkcm-row-tools">
            <button type="button" data-action="view-pack" title="Open this compendium"><i class="fas fa-eye"></i></button>
            ${canManageCompendiums ? `
              <button type="button" data-action="export-pack" title="Export this pack"><i class="fas fa-file-export"></i></button>
              <button type="button" data-action="import-pack" title="Import JSON into this pack"><i class="fas fa-file-import"></i></button>
            ` : ""}
          </div>
        </div>
        ${this.buildPackFolderTreeHtml(pack)}
      </div>
    `).join("");
  }

  buildResultsHtml() {
    if (this.browserState.loading) return '<div class="mkcm-loading"><i class="fas fa-spinner fa-spin"></i> Loading compendium indexes...</div>';
    if (!this.browserState.searched) return `<div class="mkcm-empty">${escapeHtml(this.browserState.message)}</div>`;
    if (!this.browserState.results.length) return `<div class="mkcm-empty">${escapeHtml(this.browserState.message)}</div>`;

    return this.browserState.results.map(entry => `
      <div class="mkcm-result-row" draggable="true" data-pack-id="${escapeHtml(entry.packId)}" data-entry-id="${escapeHtml(entry.id)}" data-document-name="${escapeHtml(entry.documentName)}">
        <img class="mkcm-result-img" src="${escapeHtml(entry.img)}" alt="" />
        <div class="mkcm-result-main">
          <div class="mkcm-result-title">${escapeHtml(entry.name)}</div>
          <div class="mkcm-result-meta">
            ${escapeHtml(entry.type)} · ${escapeHtml(entry.packTitle)}${entry.folderPath ? ` · ${escapeHtml(entry.folderPath)}` : ""}
          </div>
        </div>
      </div>
    `).join("");
  }

  buildSelectedToolsHtml() {
    const pack = this.selectedPack;
    if (!pack) {
      return `
        <div class="mkcm-browser-tools-note">
          Select a pack to enable pack import/export tools.
        </div>
      `;
    }

    return `
      <div class="mkcm-browser-tools-note">
        <strong>${escapeHtml(getPackTitle(pack))}</strong>
      </div>
      <div class="mkcm-browser-tools-buttons">
        <button type="button" data-action="export-selected-pack"><i class="fas fa-file-export"></i> Export Pack</button>
        <button type="button" data-action="import-selected-pack"><i class="fas fa-file-import"></i> Import Pack</button>
      </div>
    `;
  }

  buildHtml() {
    return `
      <div class="mkcm-browser">
        ${this.buildFiltersHtml()}
        <div class="mkcm-browser-body">
          <aside class="mkcm-browser-sidebar">
            <section>
              <h3>Compendium Packs</h3>
              <div class="mkcm-pack-list">${this.buildPackListHtml()}</div>
            </section>
          </aside>
          <main class="mkcm-browser-results">
            <div class="mkcm-results-header">
              <strong>Results</strong>
              <span>${escapeHtml(this.browserState.message)}</span>
            </div>
            <div class="mkcm-results-list">${this.buildResultsHtml()}</div>
          </main>
        </div>
      </div>
    `;
  }

  async runSingleBrowserAction(actionKey, button, callback) {
    if (this._busyActions.has(actionKey)) return null;

    this._busyActions.add(actionKey);
    const previousDisabled = button?.disabled ?? false;
    if (button) button.disabled = true;

    try {
      return await callback();
    } finally {
      this._busyActions.delete(actionKey);
      if (button) button.disabled = previousDisabled;
    }
  }

  activateBrowserListeners(root) {
    if (!root) return;

    this._listenerController?.abort();
    this._listenerController = new AbortController();
    const listenerOptions = { signal: this._listenerController.signal };

    this.restoreSidebarScroll(root, listenerOptions);

    root.querySelector('[data-action="search"]')?.addEventListener("click", async event => {
      event.preventDefault();
      readBrowserStateFromForm(root, this.browserState);
      await this.runSearch();
    }, listenerOptions);

    root.querySelector('[data-action="refresh"]')?.addEventListener("click", async event => {
      event.preventDefault();
      await this.refreshBrowser();
    }, listenerOptions);

    root.querySelector('[name="query"]')?.addEventListener("keydown", async event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      readBrowserStateFromForm(root, this.browserState);
      await this.runSearch();
    }, listenerOptions);

    for (const select of root.querySelectorAll("select")) {
      select.addEventListener("change", async () => {
        const previousPackId = this.browserState.packId;
        readBrowserStateFromForm(root, this.browserState);
        if (["documentName", "packageName"].includes(select.name) || (select.name === "packId" && this.browserState.packId !== previousPackId)) this.browserState.folderId = "";
        await this.runSearch();
      }, listenerOptions);
    }

    root.addEventListener("click", async event => {
      const button = event.target?.closest?.("button[data-action]");
      if (!button) return;
      const action = button.dataset.action;

      if (["search", "refresh"].includes(action)) return;

      event.preventDefault();
      event.stopPropagation();

      const packRow = button.closest("[data-pack-id]");
      const resultRow = button.closest(".mkcm-result-row");
      const folderRow = button.closest("[data-folder-id]");
      const packId = resultRow?.dataset?.packId ?? packRow?.dataset?.packId ?? this.browserState.packId;
      const pack = resolvePack(packId);
      const folderId = folderRow?.dataset?.folderId ?? this.browserState.folderId;

      switch (action) {
        case "select-pack":
          this.captureSidebarScroll(root);
          this.browserState.packId = packId ?? "";
          this.browserState.folderId = "";
          await this.runSearch();
          return;
        case "select-folder":
          this.captureSidebarScroll(root);
          this.browserState.packId = packId ?? this.browserState.packId ?? "";
          this.browserState.folderId = folderId ?? "";
          await this.runSearch();
          return;
        case "view-pack":
          if (!pack) return;
          try {
            if (getFoundryGeneration() >= 13) pack.render?.({ force: true });
            else pack.render?.(true);
          } catch (err) {
            error("Failed to open compendium browser pack.", err);
          }
          return;
        case "export-pack":
          return this.runSingleBrowserAction(`export-pack:${packId ?? ""}`, button, async () => {
            if (pack && await confirmExportAction({ title: "Export Compendium Pack", message: `Export "${getPackTitle(pack)}" to JSON?` })) return exportPackToJson(pack);
            return null;
          });
        case "import-pack":
          return this.runSingleBrowserAction(`import-pack:${packId ?? ""}`, button, async () => openImportDialog(pack));
        case "export-selected-pack":
          return this.runSingleBrowserAction(`export-pack:${this.selectedPack?.collection ?? "selected"}`, button, async () => {
            if (this.selectedPack && await confirmExportAction({ title: "Export Compendium Pack", message: `Export "${getPackTitle(this.selectedPack)}" to JSON?` })) return exportPackToJson(this.selectedPack);
            return null;
          });
        case "import-selected-pack":
          return this.runSingleBrowserAction(`import-pack:${this.selectedPack?.collection ?? "selected"}`, button, async () => openImportDialog(this.selectedPack));
      }
    }, listenerOptions);

    root.addEventListener("dblclick", async event => {
      const row = event.target?.closest?.(".mkcm-result-row");
      if (row) {
        event.preventDefault();
        event.stopPropagation();

        const pack = resolvePack(row.dataset.packId);
        const entryId = row.dataset.entryId;
        if (!pack || !entryId) return;

        try {
          const doc = await pack.getDocument(entryId);
          doc?.sheet?.render?.(true);
        } catch (err) {
          error("Failed to open compendium browser entry.", err);
        }
        return;
      }
    }, listenerOptions);

    root.addEventListener("dragstart", event => {
      const row = event.target?.closest?.(".mkcm-result-row");
      if (!row) return;
      const pack = resolvePack(row.dataset.packId);
      const entryId = row.dataset.entryId;
      if (!pack || !entryId) return;
      const data = {
        type: pack.documentName ?? row.dataset.documentName ?? "Document",
        uuid: `Compendium.${pack.collection}.${entryId}`
      };
      event.dataTransfer?.setData("text/plain", JSON.stringify(data));
    }, listenerOptions);
  }
}

let mkCompendiumBrowserApp = null;

function getFoundryGeneration() {
  return Number(game.release?.generation ?? game.version?.split?.(".")?.[0] ?? 0);
}

function renderBrowserApplication(app) {
  try {
    const result = app.render({ force: true });
    if (result?.catch) result.catch(err => error("Failed to render MK Compendium Browser.", err));
    return result;
  } catch (err) {
    error("Failed to render MK Compendium Browser.", err);
    return null;
  }
}

export function openCompendiumBrowser(options = {}) {
  if (!mkCompendiumBrowserApp) mkCompendiumBrowserApp = new MkCompendiumBrowser(options);
  else {
    Object.assign(mkCompendiumBrowserApp.browserState, {
      packId: options.packId ?? mkCompendiumBrowserApp.browserState.packId,
      folderId: options.folderId ?? mkCompendiumBrowserApp.browserState.folderId
    });
  }

  renderBrowserApplication(mkCompendiumBrowserApp);
  return mkCompendiumBrowserApp;
}

export function openCompendiumBrowserFromControl(event) {
  event?.preventDefault?.();
  openCompendiumBrowser();
  return false;
}

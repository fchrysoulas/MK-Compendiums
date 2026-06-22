import { BROWSER_UI_DEFAULTS, MODULE_ID } from './constants.js';

export function injectStyles() {
  if (document.getElementById(`${MODULE_ID}-styles`)) return;

  const style = document.createElement("style");
  style.id = `${MODULE_ID}-styles`;
  style.textContent = `
    .mk-compendiums-browser .window-content {
      padding: 0;
    }

    .mkcm-browser {
      --mkcm-pack-row-line-height: var(--mkcm-setting-pack-row-line-height, ${BROWSER_UI_DEFAULTS.packRowLineHeight});
      --mkcm-pack-row-min-height: var(--mkcm-setting-pack-row-min-height, ${BROWSER_UI_DEFAULTS.packRowMinHeight});
      --mkcm-selector-background: var(--mkcm-setting-selector-background, ${BROWSER_UI_DEFAULTS.selectorBackground});
      --mkcm-selector-background-hover: var(--mkcm-setting-selector-background-hover, ${BROWSER_UI_DEFAULTS.selectorBackgroundHover});
      --mkcm-selector-accent: var(--mkcm-setting-selector-accent, ${BROWSER_UI_DEFAULTS.selectorAccent});
      --mkcm-action-icon-size: var(--mkcm-setting-action-icon-size, ${BROWSER_UI_DEFAULTS.actionIconSize});
      --mkcm-action-icon-font-size: var(--mkcm-setting-action-icon-font-size, ${BROWSER_UI_DEFAULTS.actionIconFontSize});
      --mkcm-sidebar-width: var(--mkcm-setting-sidebar-width, ${BROWSER_UI_DEFAULTS.sidebarWidth});
      --mkcm-result-image-size: var(--mkcm-setting-result-image-size, ${BROWSER_UI_DEFAULTS.resultImageSize});
      --mkcm-folder-indent: var(--mkcm-setting-folder-indent, ${BROWSER_UI_DEFAULTS.folderIndent});
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .mkcm-browser-filters {
      flex: 0 0 auto;
      padding: 8px;
      border-bottom: 1px solid var(--color-border-light-tertiary, rgba(0,0,0,0.25));
    }

    .mkcm-browser-search-row,
    .mkcm-browser-filter-row {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }

    .mkcm-browser-search-row {
      flex-wrap: nowrap;
    }

    .mkcm-browser-search-row input[type="search"] {
      flex: 1 1 auto;
      min-width: 0;
    }

    .mkcm-browser-search-row button {
      flex: 0 0 auto;
      width: auto;
      min-width: 86px;
      white-space: nowrap;
    }

    .mkcm-browser-filter-row label {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 150px;
      font-size: 12px;
    }

    .mkcm-browser-body {
      display: grid;
      grid-template-columns: var(--mkcm-sidebar-width) 1fr;
      gap: 0;
      min-height: 0;
      flex: 1 1 auto;
    }

    .mkcm-browser-sidebar,
    .mkcm-browser-results {
      min-height: 0;
      overflow: auto;
    }

    .mkcm-browser-sidebar {
      border-right: 1px solid var(--color-border-light-tertiary, rgba(0,0,0,0.25));
    }

    .mkcm-browser-sidebar section {
      padding: 8px;
      border-bottom: 1px solid var(--color-border-light-tertiary, rgba(0,0,0,0.25));
    }

    .mkcm-browser-sidebar h3 {
      margin: 0 0 6px 0;
      font-size: 13px;
      text-transform: uppercase;
      opacity: 0.85;
    }

    .mkcm-pack-block {
      margin-bottom: 0;
    }

    .mkcm-pack-folder-tree {
      margin: 0 0 2px 10px;
      padding-left: 5px;
      border-left: 1px solid var(--color-border-light-tertiary, rgba(0,0,0,0.25));
    }

    .mkcm-tree-empty {
      padding: 5px 4px;
      text-align: left;
      font-size: 12px;
    }

    .mkcm-pack-row,
    .mkcm-folder-row-wrap,
    .mkcm-result-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 1px 3px;
      border-radius: 4px;
    }

    .mkcm-pack-row,
    .mkcm-folder-row-wrap {
      min-height: var(--mkcm-pack-row-min-height);
      line-height: var(--mkcm-pack-row-line-height);
    }

    .mkcm-pack-row.active,
    .mkcm-folder-row-wrap.active,
    .mkcm-folder-row.active {
      background: var(--mkcm-selector-background);
      box-shadow: inset 3px 0 0 var(--mkcm-selector-accent);
    }

    .mkcm-result-row:hover,
    .mkcm-pack-row:hover,
    .mkcm-folder-row-wrap:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    .mkcm-pack-row.active:hover,
    .mkcm-folder-row-wrap.active:hover,
    .mkcm-folder-row.active:hover {
      background: var(--mkcm-selector-background-hover);
    }

    .mkcm-pack-main,
    .mkcm-folder-main,
    .mkcm-folder-row {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      background: transparent;
      display: block;
      justify-content: flex-start !important;
      text-align: left !important;
      padding: 0 2px;
      cursor: pointer;
      color: inherit;
      line-height: var(--mkcm-pack-row-line-height);
    }

    .mkcm-pack-main > *,
    .mkcm-folder-main > *,
    .mkcm-folder-row > * {
      width: 100%;
      text-align: left !important;
    }

    .mkcm-folder-row-wrap {
      padding-left: calc(4px + (var(--mkcm-folder-depth, 0) * var(--mkcm-folder-indent)));
    }

    .mkcm-folder-icon {
      color: var(--mkcm-folder-color, inherit);
    }

    .mkcm-pack-title,
    .mkcm-result-title {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .mkcm-pack-title {
      line-height: var(--mkcm-pack-row-line-height);
    }

    .mkcm-pack-meta,
    .mkcm-result-meta {
      display: block;
      font-size: 10px;
      opacity: 0.75;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mkcm-pack-meta {
      font-size: 9px;
    }

    .mkcm-row-tools {
      flex: 0 0 auto;
      display: flex;
      gap: 2px;
      margin-left: auto;
    }

    .mkcm-row-tools button {
      flex: 0 0 auto;
      width: var(--mkcm-action-icon-size);
      height: var(--mkcm-action-icon-size);
      min-width: var(--mkcm-action-icon-size);
      line-height: 1;
      padding: 0;
      font-size: var(--mkcm-action-icon-font-size);
    }

    .mkcm-row-tools button i {
      margin: 0;
      font-size: var(--mkcm-action-icon-font-size);
    }

    .mkcm-results-header {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 8px;
      background: var(--color-bg, rgba(0,0,0,0.15));
      border-bottom: 1px solid var(--color-border-light-tertiary, rgba(0,0,0,0.25));
    }

    .mkcm-results-list {
      padding: 6px;
    }

    .mkcm-result-row {
      border-bottom: 1px solid rgba(0, 0, 0, 0.15);
    }

    .mkcm-result-img {
      flex: 0 0 var(--mkcm-result-image-size);
      width: var(--mkcm-result-image-size);
      height: var(--mkcm-result-image-size);
      object-fit: cover;
      border: 1px solid rgba(0, 0, 0, 0.25);
      border-radius: 3px;
    }

    .mkcm-result-main {
      flex: 1 1 auto;
      min-width: 0;
    }

    .mkcm-empty,
    .mkcm-loading {
      padding: 12px;
      text-align: center;
      opacity: 0.8;
    }


    .mk-compendiums-settings .window-content {
      padding: 8px 10px;
      overflow-y: auto;
    }

    .mk-compendiums-settings .window-content > form.mkcm-settings-form,
    .mkcm-settings-form {
      display: block !important;
      height: auto !important;
      min-height: 0 !important;
      margin: 0;
      padding: 0;
      align-content: flex-start !important;
      justify-content: flex-start !important;
    }

    .mkcm-settings-intro {
      margin: 0 0 8px 0;
    }

    .mkcm-settings-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px 0;
    }

    .mkcm-settings-row label {
      flex: 0 0 190px;
      font-weight: 600;
    }

    .mkcm-settings-range-row,
    .mkcm-settings-color-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .mkcm-settings-range-row input[type="range"] {
      flex: 1 1 auto;
      min-width: 180px;
    }

    .mkcm-range-value {
      flex: 0 0 54px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .mkcm-settings-color-row input[type="color"] {
      flex: 0 0 46px;
      width: 46px;
      height: 26px;
      padding: 0 2px;
    }

    .mkcm-settings-color-row .mkcm-color-text {
      flex: 1 1 auto;
      min-width: 110px;
      font-family: monospace;
    }


    .mkcm-settings-row .notes {
      flex: 1 1 100%;
      margin: 2px 0 0 198px;
    }

    .mkcm-settings-form footer.sheet-footer {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid var(--color-border-light-tertiary, rgba(0,0,0,0.25));
    }
  `;
  document.head.appendChild(style);
}

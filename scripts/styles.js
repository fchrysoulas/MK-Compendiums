import { MODULE_ID } from './constants.js';

export function injectStyles() {
  if (document.getElementById(`${MODULE_ID}-styles`)) return;

  const style = document.createElement("style");
  style.id = `${MODULE_ID}-styles`;
  style.textContent = `
    .mk-compendiums-browser {
      --mkcm-bg: #080b12;
      --mkcm-surface: rgba(20, 25, 37, 0.72);
      --mkcm-surface-strong: rgba(27, 33, 47, 0.88);
      --mkcm-surface-soft: rgba(255, 255, 255, 0.035);
      --mkcm-border: rgba(255, 255, 255, 0.09);
      --mkcm-border-strong: rgba(255, 255, 255, 0.15);
      --mkcm-text: #f4f1eb;
      --mkcm-muted: #a6adbb;
      --mkcm-faint: #747d8d;
      --mkcm-accent: #dda85b;
      --mkcm-accent-bright: #f1c171;
      --mkcm-accent-soft: rgba(221, 168, 91, 0.16);
      --mkcm-accent-border: rgba(221, 168, 91, 0.42);
      --mkcm-danger: #ef767a;
      overflow: hidden;
      border: 1px solid var(--mkcm-border-strong);
      border-radius: 14px;
      background:
        linear-gradient(145deg, rgba(17, 22, 33, 0.94), rgba(7, 10, 17, 0.96));
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.58),
        0 8px 24px rgba(0, 0, 0, 0.34),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);
      color: var(--mkcm-text);
      backdrop-filter: blur(22px) saturate(125%);
    }

    .mk-compendiums-browser .window-header {
      min-height: 42px;
      padding: 0 12px;
      border-bottom: 1px solid var(--mkcm-border);
      background: rgba(8, 11, 18, 0.68);
      color: var(--mkcm-text);
      backdrop-filter: blur(18px);
    }

    .mk-compendiums-browser .window-header .window-title {
      font-size: 13px;
      font-weight: 650;
      letter-spacing: 0.015em;
    }

    .mk-compendiums-browser .window-header i {
      color: var(--mkcm-accent);
    }

    .mk-compendiums-browser .window-header button {
      color: var(--mkcm-muted);
    }

    .mk-compendiums-browser .window-header button:hover {
      color: var(--mkcm-text);
    }

    .mk-compendiums-browser .window-content {
      padding: 0;
      overflow: hidden;
      background: transparent;
      color: var(--mkcm-text);
    }

    .mkcm-browser {
      position: relative;
      isolation: isolate;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      color: var(--mkcm-text);
      background:
        radial-gradient(circle at 12% -5%, rgba(86, 115, 178, 0.16), transparent 32%),
        radial-gradient(circle at 92% 105%, rgba(182, 112, 60, 0.14), transparent 34%),
        linear-gradient(135deg, rgba(14, 18, 28, 0.82), rgba(8, 11, 18, 0.9));
    }

    .mkcm-browser::before,
    .mkcm-browser::after {
      content: "";
      position: absolute;
      z-index: -1;
      width: 260px;
      height: 260px;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
    }

    .mkcm-browser::before {
      top: -145px;
      left: 18%;
      background: rgba(67, 96, 164, 0.22);
    }

    .mkcm-browser::after {
      right: -120px;
      bottom: -155px;
      background: rgba(195, 126, 64, 0.18);
    }

    .mkcm-browser-filters {
      position: relative;
      z-index: 2;
      flex: 0 0 auto;
      padding: 8px 12px;
      border-bottom: 1px solid var(--mkcm-border);
      background: rgba(12, 16, 25, 0.58);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
      backdrop-filter: blur(16px) saturate(125%);
    }

    .mkcm-browser-search-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .mkcm-browser-search-row input[type="search"],
    .mkcm-browser-search-row select {
      height: 34px;
      margin: 0;
      border: 1px solid var(--mkcm-border);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.035),
        0 4px 15px rgba(0, 0, 0, 0.1);
      color: var(--mkcm-text);
      font-family: var(--font-sans, sans-serif);
      font-size: 11px;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    .mkcm-browser-search-row input[type="search"] {
      width: auto;
      min-width: 160px;
      flex: 1 1 220px;
      padding: 0 11px;
    }

    .mkcm-browser-search-actions {
      margin-left: auto;
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
    }

    .mkcm-browser-search-row input[type="search"]::placeholder {
      color: var(--mkcm-faint);
    }

    .mkcm-browser-search-row input[type="search"]:focus,
    .mkcm-browser-search-row select:focus {
      border-color: var(--mkcm-accent-border);
      box-shadow:
        0 0 0 2px rgba(221, 168, 91, 0.1),
        0 6px 20px rgba(0, 0, 0, 0.14);
      outline: none;
    }

    .mkcm-browser-search-row select {
      min-width: 0;
      width: 124px;
      flex: 0 1 124px;
      padding: 0 28px 0 9px;
      background-color: rgba(7, 10, 17, 0.82);
    }

    .mkcm-browser-search-row select[name="packageName"] {
      width: 132px;
      flex-basis: 132px;
    }

    .mkcm-browser-search-row select option {
      background: #111722;
      color: var(--mkcm-text);
    }

    .mkcm-browser-search-row button {
      width: auto;
      min-width: 88px;
      min-height: 34px;
      margin: 0;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: 1px solid var(--mkcm-border);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025));
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.07),
        0 4px 14px rgba(0, 0, 0, 0.14);
      color: var(--mkcm-text);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      transition:
        border-color 120ms ease,
        background 120ms ease,
        color 120ms ease,
        transform 120ms ease;
    }

    .mkcm-browser-search-row button:hover,
    .mkcm-browser-search-row button:focus {
      border-color: var(--mkcm-accent-border);
      background: var(--mkcm-accent-soft);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.07),
        0 6px 18px rgba(0, 0, 0, 0.2);
      color: var(--mkcm-accent-bright);
      transform: translateY(-1px);
      outline: none;
    }

    .mkcm-browser-search-row button[data-action="search"] {
      border-color: var(--mkcm-accent-border);
      background:
        linear-gradient(180deg, rgba(221, 168, 91, 0.25), rgba(221, 168, 91, 0.13));
      color: #ffe0aa;
    }

    .mkcm-browser-search-row button:disabled {
      opacity: 0.42;
      cursor: not-allowed;
      transform: none;
    }

    .mkcm-browser-body {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(250px, 292px) minmax(0, 1fr);
      min-height: 0;
      flex: 1 1 auto;
    }

    .mkcm-browser-sidebar,
    .mkcm-browser-results {
      min-width: 0;
      min-height: 0;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(221, 168, 91, 0.38) rgba(255, 255, 255, 0.025);
    }

    .mkcm-browser-sidebar {
      border-right: 1px solid var(--mkcm-border);
      background:
        linear-gradient(180deg, rgba(23, 29, 42, 0.58), rgba(12, 16, 25, 0.52));
      box-shadow: 10px 0 32px rgba(0, 0, 0, 0.11);
      backdrop-filter: blur(18px);
    }

    .mkcm-browser-sidebar section {
      padding: 0 8px 16px;
    }

    .mkcm-browser-sidebar h3 {
      position: sticky;
      top: 0;
      z-index: 2;
      min-height: 51px;
      margin: 0 -8px 9px;
      padding: 0 13px 0 17px;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--mkcm-border);
      background: rgba(17, 22, 33, 0.94);
      color: var(--mkcm-muted);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      backdrop-filter: blur(14px);
    }

    .mkcm-browser-sidebar h3::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--mkcm-accent);
      box-shadow: 0 0 12px rgba(221, 168, 91, 0.7);
    }

    .mkcm-pack-block {
      margin: 2px 0;
    }

    .mkcm-pack-folder-tree {
      margin: 3px 0 5px 13px;
      padding-left: 9px;
      border-left: 1px solid rgba(255, 255, 255, 0.075);
    }

    .mkcm-pack-row,
    .mkcm-folder-row-wrap {
      min-height: 36px;
      display: flex;
      align-items: stretch;
      gap: 4px;
      border: 1px solid transparent;
      border-radius: 7px;
      color: var(--mkcm-muted);
      transition:
        border-color 120ms ease,
        background 120ms ease,
        box-shadow 120ms ease;
    }

    .mkcm-folder-row-wrap {
      min-height: 32px;
      margin: 2px 0;
      padding-left: calc(var(--mkcm-folder-depth, 0) * 12px);
    }

    .mkcm-pack-row:hover,
    .mkcm-folder-row-wrap:hover {
      border-color: rgba(255, 255, 255, 0.055);
      background: rgba(255, 255, 255, 0.045);
      color: var(--mkcm-text);
    }

    .mkcm-pack-row.active,
    .mkcm-folder-row-wrap.active,
    .mkcm-folder-row.active {
      border-color: var(--mkcm-accent-border);
      background:
        linear-gradient(90deg, rgba(221, 168, 91, 0.2), rgba(221, 168, 91, 0.07));
      box-shadow:
        inset 3px 0 0 var(--mkcm-accent),
        0 6px 18px rgba(0, 0, 0, 0.11);
      color: var(--mkcm-accent-bright);
    }

    .mkcm-pack-main,
    .mkcm-folder-main,
    .mkcm-folder-row {
      min-width: 0;
      flex: 1 1 auto;
      margin: 0;
      padding: 4px 7px;
      border: 0;
      border-radius: 0;
      display: block;
      background: transparent;
      box-shadow: none;
      color: inherit;
      cursor: pointer;
      line-height: 1.25;
      text-align: left !important;
    }

    .mkcm-folder-main,
    .mkcm-folder-row {
      display: flex;
      align-items: center;
      padding-block: 2px;
    }

    .mkcm-pack-main:hover,
    .mkcm-pack-main:focus,
    .mkcm-folder-main:hover,
    .mkcm-folder-main:focus,
    .mkcm-folder-row:hover,
    .mkcm-folder-row:focus {
      box-shadow: none;
      outline: none;
    }

    .mkcm-pack-main > *,
    .mkcm-folder-main > *,
    .mkcm-folder-row > * {
      width: 100%;
      text-align: left !important;
    }

    .mkcm-pack-main i {
      color: var(--mkcm-accent);
      filter: drop-shadow(0 0 7px rgba(221, 168, 91, 0.22));
    }

    .mkcm-folder-icon {
      color: var(--mkcm-folder-color, var(--mkcm-accent));
      filter: drop-shadow(0 0 7px rgba(221, 168, 91, 0.18));
    }

    .mkcm-pack-title,
    .mkcm-result-title {
      display: block;
      overflow: hidden;
      color: var(--mkcm-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .mkcm-pack-row:hover .mkcm-pack-title,
    .mkcm-pack-row.active .mkcm-pack-title {
      color: var(--mkcm-text);
    }

    .mkcm-pack-row.active .mkcm-pack-title {
      color: #ffdfaa;
      font-weight: 700;
    }

    .mkcm-pack-meta,
    .mkcm-result-meta {
      display: block;
      overflow: hidden;
      color: var(--mkcm-faint);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 9px;
    }

    .mkcm-row-tools {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 3px;
      margin-left: auto;
      padding-right: 4px;
      opacity: 0;
      transition: opacity 120ms ease;
    }

    .mkcm-pack-row:hover .mkcm-row-tools,
    .mkcm-pack-row:focus-within .mkcm-row-tools,
    .mkcm-broken-link-row .mkcm-row-tools {
      opacity: 1;
    }

    .mkcm-row-tools button {
      width: 26px;
      min-width: 26px;
      height: 26px;
      min-height: 26px;
      margin: 0;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 6px;
      display: grid;
      place-items: center;
      background: transparent;
      box-shadow: none;
      color: var(--mkcm-faint);
      font-size: 9px;
    }

    .mkcm-row-tools button:hover,
    .mkcm-row-tools button:focus {
      border-color: var(--mkcm-accent-border);
      background: var(--mkcm-accent-soft);
      box-shadow: none;
      color: var(--mkcm-accent-bright);
      outline: none;
    }

    .mkcm-row-tools button i {
      margin: 0;
    }

    .mkcm-browser-results {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: rgba(7, 10, 17, 0.16);
    }

    .mkcm-results-header {
      position: sticky;
      top: 0;
      z-index: 2;
      min-height: 51px;
      flex: 0 0 auto;
      padding: 8px 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid var(--mkcm-border);
      background: rgba(13, 17, 27, 0.88);
      backdrop-filter: blur(14px);
    }

    .mkcm-results-heading {
      min-width: 0;
      flex: 1 1 auto;
    }

    .mkcm-results-header strong {
      color: var(--mkcm-text);
      font-size: 15px;
      font-weight: 670;
    }

    .mkcm-results-header strong::before {
      content: "";
      width: 6px;
      height: 6px;
      margin-right: 8px;
      border-radius: 50%;
      display: inline-block;
      vertical-align: 2px;
      background: var(--mkcm-accent);
      box-shadow: 0 0 12px rgba(221, 168, 91, 0.7);
    }

    .mkcm-results-status {
      min-width: 0;
      display: block;
      margin: 3px 0 0 14px;
      overflow: hidden;
      color: var(--mkcm-faint);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 10px;
    }

    .mkcm-results-view {
      height: 34px;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 8px 0 10px;
      border: 1px solid var(--mkcm-border);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.025);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
      color: var(--mkcm-muted);
      font-size: 10px;
      font-weight: 650;
      white-space: nowrap;
    }

    .mkcm-results-view > i {
      color: var(--mkcm-accent);
      font-size: 10px;
    }

    .mkcm-results-view select {
      height: 24px;
      min-width: 76px;
      margin: 0;
      padding: 0 22px 0 6px;
      border: 1px solid transparent;
      border-radius: 6px;
      background-color: rgba(7, 10, 17, 0.82);
      box-shadow: none;
      color: var(--mkcm-text);
      font-family: var(--font-sans, sans-serif);
      font-size: 10px;
    }

    .mkcm-results-view select:focus {
      border-color: var(--mkcm-accent-border);
      box-shadow: 0 0 0 1px var(--mkcm-accent-soft);
      outline: none;
    }

    .mkcm-results-view select option {
      background: #111722;
      color: var(--mkcm-text);
    }

    .mkcm-results-list {
      min-height: 0;
      flex: 1 1 auto;
      overflow-y: scroll;
      padding: 12px;
      scrollbar-gutter: stable;
      scrollbar-width: thin;
      scrollbar-color: rgba(221, 168, 91, 0.38) rgba(255, 255, 255, 0.025);
    }

    .mkcm-results-list.mkcm-results-icons {
      --mkcm-icon-frame-size: 132px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      grid-auto-rows: minmax(202px, auto);
      align-content: start;
      gap: 12px;
    }

    .mkcm-result-row {
      min-width: 0;
      min-height: 54px;
      margin-bottom: 8px;
      padding: 7px;
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
      border: 1px solid var(--mkcm-border);
      border-radius: 10px;
      background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025));
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.045);
      cursor: pointer;
      transition:
        transform 140ms ease,
        border-color 140ms ease,
        background 140ms ease,
        box-shadow 140ms ease;
    }

    .mkcm-result-row:hover,
    .mkcm-result-row:focus-within {
      z-index: 1;
      border-color: var(--mkcm-accent-border);
      background:
        linear-gradient(145deg, rgba(221, 168, 91, 0.12), rgba(255, 255, 255, 0.035));
      box-shadow:
        0 13px 30px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(221, 168, 91, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.07);
      transform: translateY(-2px);
      outline: none;
    }

    .mkcm-result-row:hover .mkcm-result-title {
      color: var(--mkcm-text);
    }

    .mkcm-result-image {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 7px;
      background: rgba(0, 0, 0, 0.24);
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.25);
    }

    .mkcm-result-img {
      width: 100%;
      height: 100%;
      display: block;
      border: 0;
      object-fit: cover;
    }

    .mkcm-result-main {
      min-width: 0;
      flex: 1 1 auto;
    }

    .mkcm-result-title {
      margin-bottom: 3px;
      font-size: 11px;
    }

    .mk-compendiums-browser .mkcm-results-icons .mkcm-result-row {
      min-height: 202px !important;
      height: auto !important;
      margin: 0;
      padding: 7px;
      box-sizing: border-box;
      display: grid;
      grid-template-rows: var(--mkcm-icon-frame-size) auto;
      align-items: stretch;
      align-content: start;
      gap: 8px;
    }

    .mk-compendiums-browser .mkcm-results-icons .mkcm-result-image {
      width: var(--mkcm-icon-frame-size) !important;
      min-width: var(--mkcm-icon-frame-size) !important;
      max-width: var(--mkcm-icon-frame-size) !important;
      height: var(--mkcm-icon-frame-size) !important;
      min-height: var(--mkcm-icon-frame-size) !important;
      max-height: var(--mkcm-icon-frame-size) !important;
      box-sizing: border-box;
      justify-self: center;
      flex: 0 0 var(--mkcm-icon-frame-size);
      aspect-ratio: 1 / 1;
    }

    .mk-compendiums-browser .mkcm-results-icons .mkcm-result-img {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      height: 100% !important;
      min-height: 0 !important;
      max-height: 100% !important;
    }

    .mk-compendiums-browser .mkcm-results-icons .mkcm-result-main {
      width: 100%;
      align-self: start;
    }

    .mkcm-results-icons .mkcm-result-title {
      margin-bottom: 4px;
      font-size: 11px;
    }

    .mkcm-results-icons .mkcm-result-meta {
      display: -webkit-box;
      overflow: hidden;
      white-space: normal;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-height: 1.35;
    }

    .mkcm-broken-link-row {
      align-items: flex-start;
      gap: 10px;
      padding: 9px;
      cursor: default;
    }

    .mkcm-broken-link-row .mkcm-result-main {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .mkcm-broken-link-row .mkcm-row-tools {
      padding-top: 2px;
      opacity: 1;
    }

    .mkcm-broken-link-header {
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .mkcm-broken-link-title {
      min-width: 0;
      overflow: hidden;
      color: var(--mkcm-text);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 700;
    }

    .mkcm-broken-link-title i {
      color: var(--mkcm-danger);
    }

    .mkcm-broken-link-badges {
      flex: 0 0 auto;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .mkcm-broken-link-badge {
      padding: 2px 6px;
      border: 1px solid rgba(221, 168, 91, 0.18);
      border-radius: 999px;
      background: rgba(221, 168, 91, 0.07);
      color: var(--mkcm-muted);
      font-size: 9px;
    }

    .mkcm-broken-link-target,
    .mkcm-broken-link-details {
      min-width: 0;
    }

    .mkcm-broken-link-target {
      display: grid;
      grid-template-columns: 86px minmax(0, 1fr);
      gap: 6px;
      align-items: center;
    }

    .mkcm-broken-link-target span,
    .mkcm-broken-link-details span {
      color: var(--mkcm-faint);
      font-size: 9px;
    }

    .mkcm-broken-link-details {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 4px 12px;
      font-size: 10px;
    }

    .mkcm-broken-link-details div {
      min-width: 0;
      display: grid;
      grid-template-columns: 78px minmax(0, 1fr);
      gap: 5px;
      align-items: baseline;
    }

    .mkcm-broken-link-details strong {
      min-width: 0;
      overflow: hidden;
      color: var(--mkcm-muted);
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .mkcm-broken-link-target code,
    .mkcm-broken-link-details code,
    .mkcm-broken-link-row .mkcm-result-meta code {
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
      color: var(--mkcm-accent-bright);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mkcm-broken-link-form code {
      user-select: text;
    }

    .mkcm-empty,
    .mkcm-loading {
      min-height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 34px;
      color: var(--mkcm-muted);
      text-align: center;
      font-size: 11px;
    }

    .mkcm-tree-empty {
      min-height: 0;
      justify-content: flex-start;
      padding: 7px;
      color: var(--mkcm-faint);
      text-align: left;
      font-size: 10px;
    }

    .mkcm-loading i {
      margin-right: 8px;
      color: var(--mkcm-accent-bright);
      filter: drop-shadow(0 0 8px rgba(221, 168, 91, 0.35));
    }

    @media (max-width: 760px) {
      .mkcm-browser-search-row {
        align-items: stretch;
        flex-wrap: wrap;
      }

      .mkcm-browser-search-row input[type="search"] {
        width: 100%;
        max-width: none;
        flex-basis: 100%;
      }

      .mkcm-browser-search-actions {
        width: 100%;
      }

      .mkcm-browser-search-actions button {
        min-width: 0;
        flex: 0 0 auto;
      }

      .mkcm-browser-body {
        grid-template-columns: minmax(190px, 220px) minmax(0, 1fr);
      }

      .mkcm-broken-link-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .mkcm-broken-link-badges {
        justify-content: flex-start;
      }

      .mkcm-broken-link-target,
      .mkcm-broken-link-details {
        grid-template-columns: 1fr;
      }

      .mkcm-results-header {
        align-items: flex-start;
        flex-direction: column;
        gap: 4px;
      }

      .mkcm-results-view {
        align-self: stretch;
        justify-content: flex-end;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mkcm-browser-search-row button,
      .mkcm-pack-row,
      .mkcm-folder-row-wrap,
      .mkcm-result-row,
      .mkcm-row-tools {
        transition: none;
      }
    }
  `;
  document.head.appendChild(style);
}

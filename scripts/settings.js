import { BROWSER_UI_DEFAULTS, BROWSER_UI_DEFAULTS_VERSION, MODULE_ID } from './constants.js';

export const SETTING_KEYS = Object.freeze({
  packRowLineHeight: "browserPackRowLineHeight",
  packRowMinHeight: "browserPackRowMinHeight",
  selectorBackground: "browserSelectorBackground",
  selectorBackgroundHover: "browserSelectorBackgroundHover",
  selectorAccent: "browserSelectorAccent",
  actionIconSize: "browserActionIconSize",
  actionIconFontSize: "browserActionIconFontSize",
  sidebarWidth: "browserSidebarWidth",
  resultImageSize: "browserResultImageSize",
  folderIndent: "browserFolderIndent"
});

const SETTINGS_DEFAULTS_VERSION_KEY = "browserUiDefaultsVersion";

const PREVIOUS_BROWSER_UI_DEFAULTS = Object.freeze({
  packRowLineHeight: "1.05",
  packRowMinHeight: "20px",
  selectorBackground: "#365f9f",
  selectorBackgroundHover: "#456fb8",
  selectorAccent: "#5a8cff"
});

const SETTING_DEFINITIONS = Object.freeze({
  packRowLineHeight: {
    name: "Browser: Pack/folder row line height",
    hint: "Line spacing for compendium pack and folder rows in the MK Compendium Browser.",
    control: "range",
    min: 0.8,
    max: 1.6,
    step: 0.05,
    unit: "",
    decimals: 2
  },
  packRowMinHeight: {
    name: "Browser: Pack/folder row minimum height",
    hint: "Minimum height for pack and folder rows.",
    control: "range",
    min: 16,
    max: 40,
    step: 1,
    unit: "px"
  },
  selectorBackground: {
    name: "Browser: Selected row background color",
    hint: "Background color for the selected compendium pack or folder.",
    control: "color"
  },
  selectorBackgroundHover: {
    name: "Browser: Selected row hover background color",
    hint: "Background color when hovering over the selected pack or folder.",
    control: "color"
  },
  selectorAccent: {
    name: "Browser: Selected row accent color",
    hint: "The left accent bar color for the selected pack or folder.",
    control: "color"
  },
  actionIconSize: {
    name: "Browser: Action icon button size",
    hint: "Width and height of small action icon buttons in the browser.",
    control: "range",
    min: 12,
    max: 28,
    step: 1,
    unit: "px"
  },
  actionIconFontSize: {
    name: "Browser: Action icon font size",
    hint: "Font size for the icon inside small action buttons.",
    control: "range",
    min: 7,
    max: 16,
    step: 1,
    unit: "px"
  },
  sidebarWidth: {
    name: "Browser: Sidebar width",
    hint: "Width of the compendium pack sidebar.",
    control: "range",
    min: 240,
    max: 520,
    step: 10,
    unit: "px"
  },
  resultImageSize: {
    name: "Browser: Result thumbnail size",
    hint: "Image thumbnail size for result rows.",
    control: "range",
    min: 24,
    max: 64,
    step: 1,
    unit: "px"
  },
  folderIndent: {
    name: "Browser: Nested folder indent size",
    hint: "Indent added per nested folder level in the pack tree.",
    control: "range",
    min: 6,
    max: 32,
    step: 1,
    unit: "px"
  }
});

let reloadPromptTimer = null;
let reloadPromptOpen = false;
let settingsConfigHookRegistered = false;
let suppressReloadPrompt = false;

function settingKey(localKey) {
  return SETTING_KEYS[localKey];
}

function fullSettingName(localKey) {
  return `${MODULE_ID}.${settingKey(localKey)}`;
}

function readSetting(localKey) {
  const key = settingKey(localKey);
  const fallback = BROWSER_UI_DEFAULTS[localKey];
  if (!key) return fallback;

  try {
    const value = game.settings.get(MODULE_ID, key);
    return value === undefined || value === null || value === "" ? fallback : value;
  } catch (_err) {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function numberFromCssValue(value, fallback, unit = "px") {
  const raw = String(value ?? fallback ?? "").trim();
  const parsed = Number.parseFloat(unit ? raw.replace(unit, "") : raw);
  if (Number.isFinite(parsed)) return parsed;
  const parsedFallback = Number.parseFloat(String(fallback ?? "").replace(unit, ""));
  return Number.isFinite(parsedFallback) ? parsedFallback : 0;
}

function toCssSize(localKey, value) {
  const definition = SETTING_DEFINITIONS[localKey] ?? {};
  if (definition.unit !== "px") return String(value ?? BROWSER_UI_DEFAULTS[localKey] ?? "");
  const number = numberFromCssValue(value, BROWSER_UI_DEFAULTS[localKey], "px");
  return `${number}px`;
}

function clampNumber(value, definition, fallback) {
  let number = Number.parseFloat(value);
  if (!Number.isFinite(number)) number = Number.parseFloat(fallback);
  if (!Number.isFinite(number)) number = 0;
  if (Number.isFinite(definition.min)) number = Math.max(definition.min, number);
  if (Number.isFinite(definition.max)) number = Math.min(definition.max, number);
  return number;
}

function formatNumber(value, definition) {
  const decimals = Number.isFinite(definition.decimals) ? definition.decimals : 0;
  const fixed = Number(value).toFixed(decimals);
  return decimals ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "").trim());
}

function normalizeColorForInput(value, fallback) {
  const raw = String(value ?? "").trim();
  if (isHexColor(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const chars = raw.slice(1).split("");
    return `#${chars.map(char => `${char}${char}`).join("")}`;
  }
  return isHexColor(fallback) ? fallback : "#5a8cff";
}

function valueForControl(localKey) {
  const definition = SETTING_DEFINITIONS[localKey] ?? {};
  const value = readSetting(localKey);
  const fallback = BROWSER_UI_DEFAULTS[localKey];

  if (definition.control === "color") return normalizeColorForInput(value, fallback);
  if (definition.control === "range") return clampNumber(numberFromCssValue(value, fallback, definition.unit), definition, numberFromCssValue(fallback, fallback, definition.unit));
  return value ?? fallback ?? "";
}

function getHtmlElement(html) {
  return html?.[0] ?? html;
}

function findSettingInput(root, fullName) {
  if (!root?.querySelector) return null;
  return root.querySelector(`[name="${fullName}"]`)
    ?? root.querySelector(`[name='${fullName}']`)
    ?? root.querySelector(`[data-setting-id="${fullName}"] input`)
    ?? root.querySelector(`[data-setting="${fullName}"] input`);
}

function replaceSettingFields(input, replacement) {
  const row = input.closest?.(".form-group") ?? input.closest?.(".form-group-stacked") ?? input.parentElement;
  const fields = input.closest?.(".form-fields") ?? input.parentElement;

  if (row) row.classList.add("mkcm-settings-row");
  if (fields?.parentElement) fields.replaceWith(replacement);
  else input.replaceWith(replacement);
}

function buildRangeControl(localKey, fullName, definition) {
  const value = valueForControl(localKey);
  const display = `${formatNumber(value, definition)}${definition.unit ?? ""}`;
  const wrapper = document.createElement("div");
  wrapper.className = "form-fields mkcm-settings-range-row";
  wrapper.innerHTML = `
    <input type="range" name="${escapeHtml(fullName)}" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${escapeHtml(value)}" />
    <span class="mkcm-range-value" data-range-value-for="${escapeHtml(fullName)}">${escapeHtml(display)}</span>
  `;

  const input = wrapper.querySelector("input");
  const output = wrapper.querySelector(".mkcm-range-value");
  input?.addEventListener("input", () => {
    if (output) output.textContent = `${formatNumber(input.value, definition)}${definition.unit ?? ""}`;
  });

  return wrapper;
}

function buildColorControl(localKey, fullName) {
  const value = valueForControl(localKey);
  const wrapper = document.createElement("div");
  wrapper.className = "form-fields mkcm-settings-color-row";
  wrapper.innerHTML = `
    <input type="color" name="${escapeHtml(fullName)}" value="${escapeHtml(value)}" />
    <input type="text" class="mkcm-color-text" data-color-text-for="${escapeHtml(fullName)}" value="${escapeHtml(value)}" />
  `;

  const colorInput = wrapper.querySelector('input[type="color"]');
  const textInput = wrapper.querySelector(".mkcm-color-text");

  colorInput?.addEventListener("input", () => {
    if (textInput) textInput.value = colorInput.value;
  });

  textInput?.addEventListener("change", () => {
    const normalized = normalizeColorForInput(textInput.value, BROWSER_UI_DEFAULTS[localKey]);
    textInput.value = normalized;
    if (colorInput) colorInput.value = normalized;
  });

  return wrapper;
}

function enhanceSettingsConfig(app, html, _data) {
  const root = getHtmlElement(html);
  if (!root) return;

  for (const [localKey, key] of Object.entries(SETTING_KEYS)) {
    const definition = SETTING_DEFINITIONS[localKey] ?? {};
    const fullName = `${MODULE_ID}.${key}`;
    const input = findSettingInput(root, fullName);
    if (!input || input.dataset.mkcmEnhanced === "true") continue;

    let replacement = null;
    if (definition.control === "range") replacement = buildRangeControl(localKey, fullName, definition);
    else if (definition.control === "color") replacement = buildColorControl(localKey, fullName);
    if (!replacement) continue;

    input.dataset.mkcmEnhanced = "true";
    replaceSettingFields(input, replacement);
  }
}

async function confirmReloadCurrentClient() {
  if (reloadPromptOpen || !game?.ready) return;
  reloadPromptOpen = true;

  const title = "Reload Required";
  const content = `
    <p>MK-Compendiums browser UI settings were saved.</p>
    <p>Reload this Foundry client now so the shared browser layout is fully refreshed?</p>
  `;

  let confirmed = false;

  try {
    if (typeof Dialog?.confirm === "function") {
      confirmed = await Dialog.confirm({
        title,
        content,
        yes: () => true,
        no: () => false,
        defaultYes: true
      });
    } else if (typeof Dialog === "function") {
      confirmed = await new Promise(resolve => {
        let settled = false;
        const resolveOnce = value => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        new Dialog({
          title,
          content,
          buttons: {
            yes: {
              icon: '<i class="fas fa-sync"></i>',
              label: "Reload Now",
              callback: () => resolveOnce(true)
            },
            no: {
              icon: '<i class="fas fa-times"></i>',
              label: "Later",
              callback: () => resolveOnce(false)
            }
          },
          default: "yes",
          close: () => resolveOnce(false)
        }).render(true);
      });
    } else {
      confirmed = window.confirm("MK-Compendiums settings were saved. Reload this Foundry client now?");
    }
  } catch (_err) {
    confirmed = window.confirm("MK-Compendiums settings were saved. Reload this Foundry client now?");
  } finally {
    reloadPromptOpen = false;
  }

  if (confirmed) window.setTimeout(() => window.location.reload(), 100);
}

function scheduleReloadConfirmation() {
  if (!game?.ready) return;
  window.clearTimeout(reloadPromptTimer);
  reloadPromptTimer = window.setTimeout(() => {
    void confirmReloadCurrentClient();
  }, 350);
}

export function getBrowserUiSettings() {
  return {
    packRowLineHeight: String(readSetting("packRowLineHeight") ?? BROWSER_UI_DEFAULTS.packRowLineHeight),
    packRowMinHeight: toCssSize("packRowMinHeight", readSetting("packRowMinHeight")),
    selectorBackground: String(readSetting("selectorBackground") ?? BROWSER_UI_DEFAULTS.selectorBackground),
    selectorBackgroundHover: String(readSetting("selectorBackgroundHover") ?? BROWSER_UI_DEFAULTS.selectorBackgroundHover),
    selectorAccent: String(readSetting("selectorAccent") ?? BROWSER_UI_DEFAULTS.selectorAccent),
    actionIconSize: toCssSize("actionIconSize", readSetting("actionIconSize")),
    actionIconFontSize: toCssSize("actionIconFontSize", readSetting("actionIconFontSize")),
    sidebarWidth: toCssSize("sidebarWidth", readSetting("sidebarWidth")),
    resultImageSize: toCssSize("resultImageSize", readSetting("resultImageSize")),
    folderIndent: toCssSize("folderIndent", readSetting("folderIndent"))
  };
}

export function applyBrowserUiSettingsToDocument() {
  const root = document?.documentElement;
  if (!root) return;

  const settings = getBrowserUiSettings();
  root.style.setProperty("--mkcm-setting-pack-row-line-height", settings.packRowLineHeight);
  root.style.setProperty("--mkcm-setting-pack-row-min-height", settings.packRowMinHeight);
  root.style.setProperty("--mkcm-setting-selector-background", settings.selectorBackground);
  root.style.setProperty("--mkcm-setting-selector-background-hover", settings.selectorBackgroundHover);
  root.style.setProperty("--mkcm-setting-selector-accent", settings.selectorAccent);
  root.style.setProperty("--mkcm-setting-action-icon-size", settings.actionIconSize);
  root.style.setProperty("--mkcm-setting-action-icon-font-size", settings.actionIconFontSize);
  root.style.setProperty("--mkcm-setting-sidebar-width", settings.sidebarWidth);
  root.style.setProperty("--mkcm-setting-result-image-size", settings.resultImageSize);
  root.style.setProperty("--mkcm-setting-folder-indent", settings.folderIndent);
}

export function registerSettings() {
  for (const [localKey, key] of Object.entries(SETTING_KEYS)) {
    game.settings.register(MODULE_ID, key, {
      name: SETTING_DEFINITIONS[localKey]?.name ?? key,
      hint: SETTING_DEFINITIONS[localKey]?.hint ?? "MK-Compendiums browser UI setting.",
      scope: "world",
      config: true,
      restricted: true,
      type: String,
      default: BROWSER_UI_DEFAULTS[localKey] ?? "",
      requiresReload: true,
      onChange: () => {
        applyBrowserUiSettingsToDocument();
        if (!suppressReloadPrompt) scheduleReloadConfirmation();
      }
    });
  }



  game.settings.register(MODULE_ID, SETTINGS_DEFAULTS_VERSION_KEY, {
    name: "Browser UI defaults version",
    hint: "Internal migration marker for MK-Compendiums browser UI defaults.",
    scope: "world",
    config: false,
    restricted: true,
    type: String,
    default: "0"
  });

  if (!settingsConfigHookRegistered) {
    settingsConfigHookRegistered = true;
    Hooks.on("renderSettingsConfig", enhanceSettingsConfig);
  }

  applyBrowserUiSettingsToDocument();
}


function valuesMatchForMigration(localKey, current, previous) {
  const definition = SETTING_DEFINITIONS[localKey] ?? {};
  if (definition.control === "color") return String(current ?? "").trim().toLowerCase() === String(previous ?? "").trim().toLowerCase();
  if (definition.unit === "px") return numberFromCssValue(current, previous, "px") === numberFromCssValue(previous, previous, "px");
  return String(current ?? "").trim() === String(previous ?? "").trim();
}

/**
 * Move worlds that saved the old dark/compact defaults to the new lighter, roomier defaults.
 * Customized values are preserved unless they exactly match the old defaults.
 */
export async function migrateBrowserUiDefaultsIfNeeded() {
  if (!game?.user?.isGM) return;

  let currentDefaultsVersion = "0";
  try {
    currentDefaultsVersion = String(game.settings.get(MODULE_ID, SETTINGS_DEFAULTS_VERSION_KEY) ?? "0");
  } catch (_err) {
    currentDefaultsVersion = "0";
  }

  if (currentDefaultsVersion === BROWSER_UI_DEFAULTS_VERSION) return;

  suppressReloadPrompt = true;
  try {
    for (const [localKey, previousValue] of Object.entries(PREVIOUS_BROWSER_UI_DEFAULTS)) {
      const currentValue = readSetting(localKey);
      if (!valuesMatchForMigration(localKey, currentValue, previousValue)) continue;
      await game.settings.set(MODULE_ID, settingKey(localKey), BROWSER_UI_DEFAULTS[localKey]);
    }

    await game.settings.set(MODULE_ID, SETTINGS_DEFAULTS_VERSION_KEY, BROWSER_UI_DEFAULTS_VERSION);
  } finally {
    suppressReloadPrompt = false;
    applyBrowserUiSettingsToDocument();
  }
}

export const MODULE_ID = "mk-compendiums";
export const MODULE_VERSION = "1.3.0";
export const EXPORT_SCHEMA = "mk-compendiums.v1";
export const DEFAULT_BATCH_SIZE = 100;
export const BROWSER_UI_DEFAULTS_VERSION = "1.1.17";

// Browser UI defaults. These are exposed as world settings in settings.js so all users share the same browser layout.
export const BROWSER_UI_DEFAULTS = Object.freeze({
  packRowLineHeight: "1.20",
  packRowMinHeight: "24px",
  selectorBackground: "#dce8ff",
  selectorBackgroundHover: "#cbdcff",
  selectorAccent: "#8db8ff",
  actionIconSize: "17px",
  actionIconFontSize: "9px",
  sidebarWidth: "320px",
  resultImageSize: "36px",
  folderIndent: "12px"
});

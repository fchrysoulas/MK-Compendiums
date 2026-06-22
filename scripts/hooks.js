import { MODULE_ID } from './constants.js';
import { getPackIdFromContextElement, optionAlreadyRegistered } from './utils.js';
import { openCompendiumBrowser, openCompendiumBrowserFromControl } from './browser.js';

export function registerCompendiumContextMenu() {
  Hooks.on("getCompendiumDirectoryEntryContext", (_html, options) => {
    if (!optionAlreadyRegistered(options, "Open MK Compendium Browser")) {
      options.push({
        name: "Open MK Compendium Browser",
        icon: '<i class="fas fa-search"></i>',
        condition: () => true,
        callback: li => {
          const packId = getPackIdFromContextElement(li);
          return openCompendiumBrowser({ packId });
        }
      });
    }
  });
}

function getBrowserSceneTool(order = 0) {
  return {
    name: `${MODULE_ID}-browser`,
    title: "MK Compendium Browser",
    icon: "fa-solid fa-search",
    order,
    button: true,
    visible: true,
    onClick: openCompendiumBrowserFromControl,
    onChange: openCompendiumBrowserFromControl
  };
}

function addToolToControl(control) {
  if (!control) return false;
  const toolName = `${MODULE_ID}-browser`;

  if (Array.isArray(control.tools)) {
    if (!control.tools.some(tool => tool?.name === toolName)) control.tools.push(getBrowserSceneTool(control.tools.length));
    return true;
  }

  if (control.tools && typeof control.tools === "object") {
    if (!control.tools[toolName]) control.tools[toolName] = getBrowserSceneTool(Object.keys(control.tools).length);
    return true;
  }

  control.tools = [getBrowserSceneTool(0)];
  return true;
}

export function registerCompendiumBrowserSceneControl() {
  Hooks.on("getSceneControlButtons", controls => {
    // Foundry v12 passes an Array<SceneControl>.
    if (Array.isArray(controls)) {
      const tokenControl = controls.find(control => ["token", "tokens"].includes(control?.name));
      if (addToolToControl(tokenControl)) return;

      if (!controls.some(control => control?.name === MODULE_ID)) {
        controls.push({
          name: MODULE_ID,
          title: "MK-Compendiums",
          icon: "fa-solid fa-book",
          layer: "controls",
          activeTool: `${MODULE_ID}-browser`,
          tools: [getBrowserSceneTool(0)]
        });
      }
      return;
    }

    // Foundry v13 passes a Record<string, SceneControl>.
    const tokenControl = controls?.tokens ?? controls?.token;
    if (addToolToControl(tokenControl)) return;

    const toolName = `${MODULE_ID}-browser`;
    if (!controls[MODULE_ID]) {
      controls[MODULE_ID] = {
        name: MODULE_ID,
        title: "MK-Compendiums",
        icon: "fa-solid fa-book",
        order: 99,
        visible: true,
        activeTool: toolName,
        tools: {
          [toolName]: getBrowserSceneTool(0)
        }
      };
    }
  });
}

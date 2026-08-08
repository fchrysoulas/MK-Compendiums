function getDialogV2() {
  return foundry?.applications?.api?.DialogV2 ?? null;
}

function getLegacyDialog() {
  return globalThis.Dialog ?? null;
}

function getDialogV2Content(content) {
  return String(content ?? "")
    .replace(/^\s*<form\b[^>]*>/i, "")
    .replace(/<\/form>\s*$/i, "");
}

export async function confirmDialog({
  title = "Confirm",
  content = "<p>Continue?</p>",
  yesLabel = "Yes",
  noLabel = "Cancel",
  yesIcon = "fa-solid fa-check",
  noIcon = "fa-solid fa-xmark",
  defaultYes = false,
  modal = true
} = {}) {
  const DialogV2 = getDialogV2();
  if (typeof DialogV2?.confirm === "function") {
    const result = await DialogV2.confirm({
      window: { title },
      content,
      modal,
      rejectClose: false,
      yes: {
        label: yesLabel,
        icon: yesIcon,
        default: defaultYes
      },
      no: {
        label: noLabel,
        icon: noIcon,
        default: !defaultYes
      }
    });
    return result === true;
  }

  const DialogClass = getLegacyDialog();
  if (typeof DialogClass?.confirm === "function") {
    return DialogClass.confirm({
      title,
      content,
      yes: () => true,
      no: () => false,
      defaultYes
    });
  }

  return window.confirm(content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

export async function waitFormDialog({
  title,
  content,
  submitLabel = "Submit",
  submitIcon = "fa-solid fa-check",
  getResult,
  modal = true
} = {}) {
  const DialogV2 = getDialogV2();
  if (typeof DialogV2?.wait === "function") {
    return DialogV2.wait({
      window: { title },
      content: getDialogV2Content(content),
      modal,
      rejectClose: false,
      buttons: [
        {
          action: "submit",
          label: submitLabel,
          icon: submitIcon,
          default: true,
          callback: async (_event, button, dialog) => {
            const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? null;
            return getResult ? getResult(form, dialog) : form;
          }
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-xmark",
          callback: async () => null
        }
      ]
    });
  }

  const DialogClass = getLegacyDialog();
  if (!DialogClass) return null;

  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    new DialogClass({
      title,
      content,
      buttons: {
        submit: {
          icon: `<i class="${submitIcon}"></i>`,
          label: submitLabel,
          callback: async html => {
            const root = html?.[0] ?? html;
            const form = root?.querySelector?.("form") ?? root ?? null;
            finish(getResult ? await getResult(form, null) : form);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => finish(null)
        }
      },
      default: "submit",
      close: () => finish(null)
    }).render(true);
  });
}

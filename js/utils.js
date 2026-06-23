export function createId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseAmount(value) {
  const normalizedValue = String(value || "")
    .replace(/\s/g, "")
    .replace(",", ".");

  return Number(normalizedValue) || 0;
}

export function formatMoney(amount, currency) {
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0)} ${currency || "DH"}`;
}

export function formatDate(dateValue) {
  return new Date(dateValue).toLocaleDateString("fr-FR");
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function buildProjectPhases(phases) {
  const sourcePhases = Array.isArray(phases) ? phases : [];
  const uniquePhases = [];
  const seen = new Set();

  ["Général", ...sourcePhases].forEach((phase) => {
    const cleanPhase = normalizeName(phase);
    const phaseKey = cleanPhase.toLowerCase();

    if (!cleanPhase || seen.has(phaseKey)) {
      return;
    }

    seen.add(phaseKey);
    uniquePhases.push(cleanPhase);
  });

  return uniquePhases;
}

export function sortByDateDesc(items, fieldName) {
  return [...items].sort((firstItem, secondItem) => {
    return new Date(secondItem[fieldName]).getTime() - new Date(firstItem[fieldName]).getTime();
  });
}

export async function showToast(message, color = "primary") {
  const toast = document.createElement("ion-toast");
  toast.message = message;
  toast.duration = 1500;
  toast.color = color;
  document.body.appendChild(toast);
  await toast.present();
}

export function confirmAction(header, message, confirmText = "Supprimer") {
  return new Promise((resolve) => {
    const alert = document.createElement("ion-alert");
    alert.cssClass = "app-overlay";
    alert.header = header;
    alert.message = message;
    alert.buttons = [
      {
        text: "Annuler",
        role: "cancel",
        handler: () => resolve(false),
      },
      {
        text: confirmText,
        role: "destructive",
        handler: () => resolve(true),
      },
    ];
    document.body.appendChild(alert);
    alert.present();
  });
}

export function promptText({ header, subHeader, value, placeholder, confirmText }) {
  return new Promise((resolve) => {
    const alert = document.createElement("ion-alert");
    alert.cssClass = "app-overlay";
    alert.header = header;
    alert.subHeader = subHeader || "";
    alert.inputs = [
      {
        name: "text",
        type: "text",
        value: value || "",
        placeholder: placeholder || "",
      },
    ];
    alert.buttons = [
      {
        text: "Annuler",
        role: "cancel",
        handler: () => resolve(null),
      },
      {
        text: confirmText || "Enregistrer",
        handler: (data) => resolve(data.text || ""),
      },
    ];
    document.body.appendChild(alert);
    alert.present();
  });
}

export async function showInfoAlert(header, message) {
  const alert = document.createElement("ion-alert");
  alert.cssClass = "app-overlay";
  alert.header = header;
  alert.message = message;
  alert.buttons = ["OK"];
  document.body.appendChild(alert);
  await alert.present();
}

export async function showActionSheet(header, buttons) {
  const sheet = document.createElement("ion-action-sheet");
  sheet.cssClass = "app-overlay";
  sheet.header = header;
  sheet.buttons = [...buttons, { text: "Annuler", role: "cancel" }];
  document.body.appendChild(sheet);
  await sheet.present();
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

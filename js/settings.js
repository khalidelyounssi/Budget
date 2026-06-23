export const DEFAULT_SETTINGS = {
  currency: "DH",
  darkMode: false,
  language: "fr",
};

export function normalizeSettings(settings) {
  const language = settings && settings.language === "en" ? "en" : DEFAULT_SETTINGS.language;

  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    id: "app-settings",
    darkMode: Boolean(settings && settings.darkMode),
    currency: settings && settings.currency ? settings.currency : DEFAULT_SETTINGS.currency,
    language,
  };
}

export function applyTheme(settings) {
  document.body.classList.toggle("dark", Boolean(settings.darkMode));
}

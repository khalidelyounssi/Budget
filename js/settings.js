export const DEFAULT_SETTINGS = {
  currency: "DH",
  darkMode: false,
  language: "fr",
  installPromptDismissed: false,
};

export function normalizeSettings(settings) {
  const supportedLanguages = ["fr", "en", "ar"];
  const language = supportedLanguages.includes(settings && settings.language)
    ? settings.language
    : DEFAULT_SETTINGS.language;

  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    id: "app-settings",
    darkMode: Boolean(settings && settings.darkMode),
    currency: settings && settings.currency ? settings.currency : DEFAULT_SETTINGS.currency,
    language,
    installPromptDismissed: Boolean(settings && settings.installPromptDismissed),
  };
}

export function applyTheme(settings) {
  document.body.classList.toggle("dark", Boolean(settings.darkMode));
  document.documentElement.dir = settings.language === "ar" ? "rtl" : "ltr";
}

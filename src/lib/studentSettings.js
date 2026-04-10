export const SETTINGS_KEYS = {
  theme: 'qf_setting_theme',
  incognito: 'qf_setting_incognito',
  a11y: 'qf_setting_a11y',
};

function readBool(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Применяет сохранённые настройки интерфейса до отрисовки страниц. */
export function hydrateStudentSettings() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('qf-theme-alt', readBool(SETTINGS_KEYS.theme));
  document.documentElement.classList.toggle('qf-a11y', readBool(SETTINGS_KEYS.a11y));
}

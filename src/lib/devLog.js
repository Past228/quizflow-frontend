/** Логи только в dev-сборке — без утечек данных в production. */
export function devLog(...args) {
  if (import.meta.env.DEV) console.log(...args);
}

export function devWarn(...args) {
  if (import.meta.env.DEV) console.warn(...args);
}

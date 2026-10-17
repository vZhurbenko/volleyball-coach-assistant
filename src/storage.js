/**
 * Хранение матча в localStorage.
 *
 * Держим только текущий матч: история прошлых игр не ведётся, единственный след
 * сыгранного матча — сохранённый PDF. Ключ версионирован, поэтому запись прошлой
 * версии приложения просто не читается, а не ломает запуск.
 */

import { isRoster } from './domain/roster.js'

export const STORAGE_VERSION = 1
export const STORAGE_KEY = `volleyball-coach-assistant:match:v${STORAGE_VERSION}`

export const ROSTER_STORAGE_VERSION = 1
export const ROSTER_STORAGE_KEY = `volleyball-coach-assistant:roster:v${ROSTER_STORAGE_VERSION}`

/**
 * @typedef {object} SavedMatch
 * @property {object[]} events — журнал матча
 * @property {object} settings — соперник, состав, кто подаёт первым
 */

/**
 * Сохраняет матч целиком: журнал и настройки. Хранилище может отказать —
 * приватный режим браузера или переполнение, — тогда матч останется в памяти,
 * а приложение продолжит работать.
 *
 * @param {SavedMatch} match
 * @param {Storage} [storage]
 * @returns {boolean} — удалось ли сохранить
 */
export function saveMatch(match, storage = globalThis.localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(match))
    return true
  } catch {
    return false
  }
}

/**
 * Читает сохранённый матч. Битые, чужие и устаревшие записи дают чистый старт:
 * возвращается null, а не исключение.
 *
 * @param {Storage} [storage]
 * @returns {SavedMatch | null}
 */
export function loadMatch(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY))
    if (!Array.isArray(saved?.events)) return null

    return { events: saved.events, settings: saved.settings ?? {} }
  } catch {
    return null
  }
}

/**
 * Забывает матч — для кнопок «Сбросить» и «Новая игра».
 *
 * @param {Storage} [storage]
 */
export function clearMatch(storage = globalThis.localStorage) {
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Хранилище недоступно — забывать нечего.
  }
}

/**
 * Сохраняет состав, дефолтную шестёрку и название команды. Как и матч, это
 * одна цельная запись: либо всё, либо ничего. Ошибка хранилища не должна
 * ломать экран.
 *
 * @param {{ players: object[], defaultLineup: object, teamName?: string }} settings
 * @param {Storage} [storage]
 * @returns {boolean}
 */
export function saveRosterSettings(settings, storage = globalThis.localStorage) {
  try {
    storage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

/**
 * Читает состав, дефолтную шестёрку и название команды. Битые игроки и чужие
 * версии дают null — вызывающий код создаст пустой состав. Отсутствующая или
 * битая шестёрка возвращается как null: её восстановит домен.
 *
 * @param {Storage} [storage]
 * @returns {{ players: object[], defaultLineup: object | null, teamName: string } | null}
 */
export function loadRosterSettings(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(ROSTER_STORAGE_KEY))
    if (!saved || typeof saved !== 'object' || !isRoster(saved.players)) return null

    const defaultLineup =
      saved.defaultLineup &&
      typeof saved.defaultLineup === 'object' &&
      saved.defaultLineup.zones &&
      typeof saved.defaultLineup.zones === 'object'
        ? saved.defaultLineup
        : null

    const teamName = typeof saved.teamName === 'string' ? saved.teamName : ''

    return { players: saved.players, defaultLineup, teamName }
  } catch {
    return null
  }
}

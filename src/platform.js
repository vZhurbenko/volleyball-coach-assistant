/**
 * Платформенные особенности, которые нельзя определить по одной возможности API.
 */

/**
 * Приложение открыто с домашнего экрана iOS.
 *
 * В этом режиме WebKit игнорирует `window.print()`, поэтому кнопку печати
 * нужно заменять на выгрузку.
 *
 * @returns {boolean}
 */
export function isIosStandalone() {
  return window.navigator?.standalone === true
}

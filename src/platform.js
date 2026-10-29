/**
 * Платформенные особенности, которые нельзя определить по одной возможности API.
 */

/**
 * Устройство на iOS/iPadOS.
 *
 * iPadOS 13+ представляется Mac'ом, поэтому одного user agent недостаточно:
 * планшет выдаёт себя за Mac, но у него есть несколько точек касания.
 *
 * @param {{ userAgent?: string, platform?: string, maxTouchPoints?: number }} [env]
 * @returns {boolean}
 */
export function isIosDevice(env = {}) {
  const userAgent = env.userAgent ?? globalThis.navigator?.userAgent ?? ''
  const platform = env.platform ?? globalThis.navigator?.platform ?? ''
  const maxTouchPoints = env.maxTouchPoints ?? globalThis.navigator?.maxTouchPoints ?? 0

  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

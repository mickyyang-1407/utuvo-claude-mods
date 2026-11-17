// Pure helpers: which color line a session title starts with, and the look (colors + sky) for that line.
import type { ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { buildScene } from './scene'

// The original deep-blue sky stops and Milky Way color.
const DEFAULT_SKY: [string, string, string] = ['#040a1c', '#0a1633', '#13234d']
const DEFAULT_MILKY = '#9db4ff'

// The host allows only letters, digits, `_` and `-` in a scene name, so `line-colors-<key>` stands for `line-colors:<key>`.
export const SCENE_PREFIX = 'ucolors-'

export type LineKey =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'brown'
  | 'black'
  | 'white'
  | 'gray'
  | 'greencircle'
  | 'bluediamond'
  | 'orangediamond'
  | 'smallblue'
  | 'building'
  | 'planet'
  | 'default'

type Line = { key: LineKey; emoji: string; label: string; en: string; h?: number; s?: number; accent?: string }

// Order matters: the first emoji the title starts with wins. blue and default use the original deep-blue values.
export const LINES: readonly Line[] = [
  { key: 'red', emoji: '🟥', label: '紅', en: 'red', h: 0, s: 45, accent: '#e5484d' },
  { key: 'orange', emoji: '🟧', label: '橘', en: 'orange', h: 25, s: 45, accent: '#f08a4b' },
  { key: 'yellow', emoji: '🟨', label: '黃', en: 'yellow', h: 48, s: 12, accent: '#e9b949' },
  { key: 'green', emoji: '🟩', label: '綠', en: 'green', h: 140, s: 45, accent: '#5cc48d' },
  { key: 'blue', emoji: '🟦', label: '藍', en: 'blue' },
  { key: 'purple', emoji: '🟪', label: '紫', en: 'purple', h: 270, s: 45, accent: '#a48bf0' },
  { key: 'brown', emoji: '🟫', label: '棕', en: 'brown', h: 25, s: 28, accent: '#b9825a' },
  { key: 'black', emoji: '⬛', label: '黑', en: 'black', h: 220, s: 6, accent: '#9aa6cc' },
  { key: 'white', emoji: '⬜', label: '白', en: 'white', h: 220, s: 4, accent: '#e6e8ef' },
  { key: 'gray', emoji: '🔳', label: '灰', en: 'gray', h: 220, s: 8, accent: '#b8bcc8' },
  { key: 'greencircle', emoji: '🟢', label: '綠圓', en: 'green circle', h: 150, s: 45, accent: '#34c77b' },
  { key: 'bluediamond', emoji: '🔷', label: '藍鑽', en: 'blue diamond', h: 200, s: 45, accent: '#4fb3e8' },
  { key: 'orangediamond', emoji: '🔶', label: '橘鑽', en: 'orange diamond', h: 35, s: 45, accent: '#f5a524' },
  { key: 'smallblue', emoji: '🔹', label: '小藍鑽', en: 'small blue diamond', h: 195, s: 45, accent: '#6cc6f0' },
  { key: 'building', emoji: '🏢', label: '大樓', en: 'building', h: 30, s: 15, accent: '#c9a27a' },
  { key: 'planet', emoji: '🪐', label: '星球', en: 'planet', h: 255, s: 45, accent: '#8f7bf0' },
  { key: 'default', emoji: '', label: '預設', en: 'default' },
]

export const LINE_KEYS: readonly LineKey[] = LINES.map(line => line.key)

export function isLineKey(value: string): value is LineKey {
  return (LINE_KEYS as readonly string[]).includes(value)
}

export function lineInfo(key: LineKey): Line {
  return LINES.find(line => line.key === key) ?? (LINES[LINES.length - 1] as Line)
}

/** Picks the color line from a session title: trims, drops U+FE0F, then matches the leading emoji.
 *  UTUVO：先拿掉開頭的工作中記號（🔥／🌸），所以「🔥 🟦 基建」也算 🟦。 */
export function pickLine(name: string): LineKey {
  const text = name.replaceAll('️', '').trim().replace(/^(?:[🔥🌸]\s*)+/u, '')

  for (const line of LINES) {
    if (line.emoji !== '' && text.startsWith(line.emoji)) {
      return line.key
    }
  }

  return 'default'
}

/** Standard HSL to six-digit lowercase hex. h in degrees, s and l in percent. */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const hue = (((h % 360) + 360) % 360) / 60
  const x = chroma * (1 - Math.abs((hue % 2) - 1))
  const [r1, g1, b1] =
    hue < 1 ? [chroma, x, 0] : hue < 2 ? [x, chroma, 0] : hue < 3 ? [0, chroma, x] : hue < 4 ? [0, x, chroma] : hue < 5 ? [x, 0, chroma] : [chroma, 0, x]
  const m = light - chroma / 2
  const channel = (value: number): string =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${channel(r1 ?? 0)}${channel(g1 ?? 0)}${channel(b1 ?? 0)}`
}

type Anchors = {
  'surface-0': string
  'surface-1': string
  'surface-2': string
  'surface-3': string
  'text-primary': string
  'text-secondary': string
  'text-muted': string
}

// Per-key lightness overrides, found by the adjustment rule when a palette failed the checks. Empty if none needed.
const OVERRIDES: Partial<Record<LineKey, { mutedL?: number; surface3L?: number }>> = {}

const FIXED_ROLES = { danger: '#e5636f', success: '#5cc48d', warning: '#f08a4b', pro: '#a48bf0' }

const ORIGINAL: Anchors = {
  'surface-0': '#0b1530',
  'surface-1': '#101c3b',
  'surface-2': '#152246',
  'surface-3': '#192850',
  'text-primary': '#eef2ff',
  'text-secondary': '#c7d0ec',
  'text-muted': '#9aa6cc',
}

export function anchorsFor(key: LineKey, mutedL = 70, surface3L = 17): { anchors: Anchors; accent: string } {
  const line = lineInfo(key)

  if (line.h === undefined || line.s === undefined || line.accent === undefined) {
    return { anchors: ORIGINAL, accent: '#e9b949' }
  }

  const { h, s } = line

  return {
    accent: line.accent,
    anchors: {
      'surface-0': hslToHex(h, s, 9),
      'surface-1': hslToHex(h, s, 12),
      'surface-2': hslToHex(h, s, 15),
      'surface-3': hslToHex(h, s, surface3L),
      'text-primary': hslToHex(h, Math.min(s, 40), 95),
      'text-secondary': hslToHex(h, Math.min(s, 30), 84),
      'text-muted': hslToHex(h, Math.min(s, 25), mutedL),
    },
  }
}

export function buildPalette(key: LineKey, mutedL = 70, surface3L = 17): ReturnType<typeof makeColors> {
  const { anchors, accent } = anchorsFor(key, mutedL, surface3L)

  return makeColors({
    label: key === 'blue' || key === 'default' ? 'Night Sky' : `Session Colors ${key}`,
    only: 'dark',
    roles: { accent, ...FIXED_ROLES },
    dark: { gray: { anchors } },
  })
}

const paletteCache = new Map<LineKey, ReturnType<typeof makeColors>>()

/** The theme and its problem list for one line, computed once. */
export function paletteFor(key: LineKey): ReturnType<typeof makeColors> {
  const cached = paletteCache.get(key)

  if (cached !== undefined) {
    return cached
  }

  const override = OVERRIDES[key]
  const built = buildPalette(key, override?.mutedL, override?.surface3L)

  paletteCache.set(key, built)

  return built
}

const sceneCache = new Map<string, string>()

/** The night-sky SVG for one line, built the first time it is needed. live＝工作中（🔥），多一團呼吸光暈。 */
export function sceneFor(key: LineKey, live = false): string {
  const cached = sceneCache.get(key + (live ? '|live' : ''))

  if (cached !== undefined) {
    return cached
  }

  const line = lineInfo(key)
  const svg =
    line.h === undefined || line.s === undefined
      ? buildScene(DEFAULT_SKY, DEFAULT_MILKY, live ? '#4b8ff0' : undefined)
      : buildScene([hslToHex(line.h, line.s, 4), hslToHex(line.h, line.s, 8), hslToHex(line.h, line.s, 14)], hslToHex(line.h, Math.min(line.s + 20, 70), 80), live ? line.accent : undefined)

  sceneCache.set(key + (live ? '|live' : ''), svg)

  return svg
}

/** Everything `$.theme.set` needs for one line. */
export function lookFor(key: LineKey, live = false): ThemeSetArgs {
  const { theme } = paletteFor(key)
  const { anchors } = anchorsFor(key, OVERRIDES[key]?.mutedL, OVERRIDES[key]?.surface3L)

  return {
    colors: theme,
    backdrop: { scene: `${SCENE_PREFIX}${key}${live ? '-live' : ''}`, glass: { blur: 14, tint: anchors['surface-0'], opacity: 0.55 } },
  }
}

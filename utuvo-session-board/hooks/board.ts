// Pure helpers for the session board. No `$`, no side effects.

export type Entry = {
  sessionId: string
  name?: string
  status: string
  statusUpdatedAt: number
  kind: string
}

export type Board = { busyCount: number; idleCount: number; lines: string[]; more: number }
export type Lang = 'zh' | 'en'

const MAX_LINES = 5
const MAX_NAME = 28
const MINUTE = 60000
const HOUR = 3600000
const STUCK = 10800000

/** Only `<digits>.json` is ever read; anything else (including secret key files) is skipped. */
export const SESSION_FILE = /^\d+\.json$/

/** Turns a duration in ms into a short Chinese phrase. */
export function formatElapsed(ms: number, lang: Lang = 'zh'): string {
  const en = lang === 'en'
  if (!Number.isFinite(ms) || ms < MINUTE) {
    return en ? 'just started' : '剛開始'
  }

  let text: string
  const h = Math.floor(ms / HOUR)
  const m = Math.floor((ms % HOUR) / MINUTE)

  if (ms < HOUR) {
    text = en ? `running ${Math.floor(ms / MINUTE)} min` : `已跑 ${Math.floor(ms / MINUTE)} 分鐘`
  } else {
    text = en ? `running ${h} h ${m} min` : `已跑 ${h} 小時 ${m} 分`
  }

  if (ms < STUCK) return text
  return en ? `${text} (over 3 hours, may be stuck)` : `${text}（超過 3 小時，可能卡住了）`
}

function displayName(name: string | undefined, lang: Lang): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''

  if (trimmed === '') {
    return lang === 'en' ? '(untitled session)' : '（未命名 Session）'
  }

  const chars = Array.from(trimmed)

  return chars.length > MAX_NAME ? `${chars.slice(0, MAX_NAME - 1).join('')}…` : trimmed
}

/** Builds what the band shows from the parsed session files. */
export function buildBoard(entries: readonly Entry[], now: number, selfId: string, lang: Lang = 'zh'): Board {
  const interactive = entries.filter(entry => entry.kind === 'interactive')
  // A timestamp that is not a finite number counts as `now`: last in the list, shown as just started.
  const stamped = (entry: Entry): number => (Number.isFinite(entry.statusUpdatedAt) ? entry.statusUpdatedAt : now)
  const busy = interactive
    .filter(entry => entry.status === 'busy')
    .sort((a, b) => stamped(a) - stamped(b))

  const lines = busy.slice(0, MAX_LINES).map(entry => {
    const self = entry.sessionId === selfId ? (lang === 'en' ? ' (this one)' : '（就是這個）') : ''

    return `• ${displayName(entry.name, lang)}${self}${lang === 'en' ? '  ' : '　'}${formatElapsed(now - stamped(entry), lang)}`
  })

  return {
    busyCount: busy.length,
    idleCount: interactive.length - busy.length,
    lines,
    more: Math.max(0, busy.length - MAX_LINES),
  }
}

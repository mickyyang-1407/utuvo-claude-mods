import type { Catalog, Row, Usage } from '../types'

// 純邏輯：把引擎的 context breakdown＋使用紀錄整理成「設定清單」。不碰 $，可單獨測。

export const IDLE_DAYS = 14

export function serverKey(wire: string): string {
  return wire.startsWith('mcp__') ? (wire.slice(5).split('__')[0] ?? wire) : wire
}

/** 一次工具呼叫要記在哪個帳上；不需要記就回 null。 */
export function usageKey(tool: string, input: Record<string, unknown>): string | null {
  if (tool.startsWith('mcp__')) return 'mcp:' + serverKey(tool)
  if (tool === 'Skill' && typeof input.skill === 'string' && input.skill !== '') return 'skill:' + input.skill
  return null
}

const DAY = 86_400_000

type Breakdown = {
  categories?: { name: string; tokens: number; isDeferred?: boolean; kind?: string }[]
  totalTokens?: number
  maxTokens?: number
  percentage?: number
  memoryFiles?: { path: string; tokens: number }[]
  mcpTools?: { name: string; serverName: string; tokens: number; isLoaded: boolean }[]
  agents?: { tokens: number }[]
  skills?: { totalSkills: number; includedSkills: number; tokens: number; skillFrontmatter: { name: string; tokens: number }[] }
}

export function build(b: Breakdown, usage: Usage, since: string, now: string, home = ''): Catalog {
  const nowMs = Date.parse(now)
  const watching = nowMs - Date.parse(since) < IDLE_DAYS * DAY
  const idle = (u: { n: number; last: string } | undefined): boolean =>
    !watching && (u === undefined || nowMs - Date.parse(u.last) > IDLE_DAYS * DAY)

  const servers = new Map<string, Row>()
  for (const t of b.mcpTools ?? []) {
    const key = serverKey(t.name)
    const row = servers.get(key) ?? {
      key, label: t.serverName || key, count: 0, tokens: 0, loadedTokens: 0, uses: 0, last: null, idle: false,
    }
    row.count += 1
    row.tokens += t.tokens
    if (t.isLoaded) row.loadedTokens += t.tokens
    servers.set(key, row)
  }
  const mcp = [...servers.values()].map(r => {
    const u = usage['mcp:' + r.key]
    return { ...r, uses: u?.n ?? 0, last: u?.last ?? null, idle: idle(u) }
  })
  mcp.sort((a, x) => x.tokens - a.tokens)

  const sk = b.skills
  const skillRows: Row[] = (sk?.skillFrontmatter ?? []).map(s => {
    const u = usage['skill:' + s.name]
    return {
      key: s.name, label: s.name, count: 1, tokens: s.tokens, loadedTokens: s.tokens,
      uses: u?.n ?? 0, last: u?.last ?? null, idle: idle(u),
    }
  })
  skillRows.sort((a, x) => x.tokens - a.tokens)

  const memory = (b.memoryFiles ?? [])
    .map(m => ({ path: home !== '' && m.path.startsWith(home) ? '~' + m.path.slice(home.length) : m.path, tokens: m.tokens }))
    .sort((a, x) => x.tokens - a.tokens)

  return {
    at: now,
    since,
    watching,
    total: b.totalTokens ?? 0,
    max: b.maxTokens ?? 0,
    percent: b.percentage ?? 0,
    categories: (b.categories ?? [])
      .filter(c => c.kind !== 'free' && c.tokens > 0)
      .map(c => ({ name: c.name, tokens: c.tokens, deferred: c.isDeferred === true || c.kind === 'deferred' })),
    mcp,
    skills: {
      total: sk?.totalSkills ?? 0,
      included: sk?.includedSkills ?? 0,
      tokens: sk?.tokens ?? 0,
      rows: skillRows,
      idleCount: skillRows.filter(r => r.idle).length,
    },
    memory,
    agents: { count: b.agents?.length ?? 0, tokens: (b.agents ?? []).reduce((s, a) => s + a.tokens, 0) },
  }
}

export function k(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(n >= 10_000 ? 0 : 1) + 'k' : String(Math.round(n))
}

export function bump(usage: Usage, key: string, now: string): Usage {
  const u = usage[key]
  return { ...usage, [key]: { n: (u?.n ?? 0) + 1, last: now } }
}

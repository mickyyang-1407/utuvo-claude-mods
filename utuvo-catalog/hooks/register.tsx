import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Usage } from '../types'
import { IDLE_DAYS, build, bump, k, usageKey } from './catalog.js'
import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// Setup catalog / 設定清單: /catalog opens a pane listing how many tokens each MCP server, skill, memory file and
// agent adds to the context, how often it was used and when last (counted from the day the mod was installed,
// kept in $.store across sessions). Read-only: ask Claude to turn things off.

const PANE = 'utuvo-catalog'
const catalog = atom({ plugin: 'utuvo-catalog', key: 'catalog' } as const, null, { shape: 'catalog-1' })

let lang: Lang = 'en'
const say = (zh: string, en: string): string => (lang === 'zh' ? zh : en)
const title = (): string => say('設定清單', 'Setup catalog')

let chain: Promise<unknown> = Promise.resolve()

async function nowIso($: EngineInterface): Promise<string> {
  return new Date(await $.clock.now()).toISOString()
}

async function since($: EngineInterface): Promise<string> {
  const s = await $.store.get('since')
  if (typeof s === 'string') return s
  const now = await nowIso($)
  await $.store.set('since', now)
  return now
}

function record($: EngineInterface, key: string): void {
  chain = chain
    .then(async () => {
      const now = await nowIso($)
      const usage = ((await $.store.get('usage')) ?? {}) as Usage
      await $.store.set('usage', bump(usage, key, now))
    })
    .catch(() => undefined)
}

async function refresh($: EngineInterface): Promise<void> {
  try {
    const u = await $.session.usage({ breakdown: 'summary' })
    const b = (u.context as { breakdown?: unknown }).breakdown
    if (b === undefined || b === null) return
    const usage = ((await $.store.get('usage')) ?? {}) as Usage
    const home = (await $.env.get('HOME')) ?? ''
    const c = build(b as Parameters<typeof build>[0], usage, await since($), await nowIso($), home)
    await update($, catalog, () => c)
  } catch {
    // keep the last figures / 讀不到就維持上一次
  }
}

const day = (iso: string | null): string => (iso === null ? '—' : iso.slice(5, 10))

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    lang = pickLang(options?.language, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    await $.command.register({
      name: 'catalog',
      description: say('設定清單：每個 MCP／skill／記憶檔佔多少 token、多久沒用', 'Setup catalog: tokens per MCP server, skill and memory file, and what went unused'),
    })
    void since($)
    return next(e)
  })

  on('command.run', { command: 'catalog' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: title() })
    const c = await read($, catalog)
    if (c === null) return { text: say('已打開「設定清單」（還讀不到用量，按「重新整理」）。', 'Opened the setup catalog (no usage figures yet; press Refresh).') }
    const mcpK = c.mcp.reduce((s, r) => s + r.tokens, 0)
    const top = c.mcp.slice(0, 3).map(r => `${r.label} ${k(r.tokens)}`).join(say('、', ', '))
    const idleMcp = c.mcp.filter(r => r.idle).length
    return {
      text: say(
        `已打開「設定清單」：對話佔 ${k(c.total)}／${k(c.max)}；MCP ${c.mcp.length} 個共 ${k(mcpK)}（最大：${top || '無'}）；` +
          `skill ${c.skills.total} 個 ${k(c.skills.tokens)}；記憶檔 ${c.memory.length} 個` +
          (c.watching ? `；使用紀錄觀察中（${IDLE_DAYS} 天後才標久沒用）` : `；久沒用 MCP ${idleMcp} 個、skill ${c.skills.idleCount} 個`),
        `Opened the setup catalog: context ${k(c.total)} / ${k(c.max)}; ${c.mcp.length} MCP servers, ${k(mcpK)} in all (largest: ${top || 'none'}); ` +
          `${c.skills.total} skills, ${k(c.skills.tokens)}; ${c.memory.length} memory files` +
          (c.watching ? `; still counting usage (unused marks start after ${IDLE_DAYS} days)` : `; unused: ${idleMcp} MCP servers, ${c.skills.idleCount} skills`),
      ),
    }
  })

  on('tool.call', async ($, e, next) => {
    const key = usageKey(e.tool, e as unknown as Record<string, unknown>)
    if (key !== null) record($, key)
    return next(e)
  }).catch(($, e, next) => next(e)) // counting must never block a tool call

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const c = await read($, catalog)
    const refreshLabel = say('重新整理', 'Refresh')
    if (c === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{say('讀取中…', 'Loading…')}</Text>
          <Button key="refresh" label={refreshLabel} onPress={() => refresh($)} />
        </Box>
      )
    }
    const idleMcp = c.mcp.filter(r => r.idle)
    const uses = (n: number, last: string | null): string =>
      say(`｜用過 ${n} 次，最後 ${day(last)}`, ` | used ${n}×, last ${day(last)}`)
    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>
            {say(`目前對話佔 ${k(c.total)} tokens（上限 ${k(c.max)}，${Math.round(c.percent)}%）  `, `Context ${k(c.total)} tokens (of ${k(c.max)}, ${Math.round(c.percent)}%)  `)}
          </Text>
          <Button key="refresh" label={refreshLabel} onPress={() => refresh($)} />
        </Box>
        <Text dimColor>
          {c.watching
            ? say(`使用紀錄從 ${day(c.since)} 開始記，滿 ${IDLE_DAYS} 天後才標「久沒用」`, `Usage counted since ${day(c.since)}; "unused" marks start after ${IDLE_DAYS} days`)
            : say(`「久沒用」＝${IDLE_DAYS} 天內沒呼叫過`, `"Unused" = not called in ${IDLE_DAYS} days`)}
          {say(`；更新於 ${c.at.slice(11, 16)} UTC`, `; updated ${c.at.slice(11, 16)} UTC`)}
        </Text>

        <Text bold>{'\n'}{say('分類', 'Categories')}</Text>
        {c.categories.map((x, i) => (
          <Text key={`c${i}`} dimColor={x.deferred}>
            {'  '}{x.name}: {k(x.tokens)}{x.deferred ? say('（按需載入，不算在對話裡）', ' (loaded on demand, not in the context)') : ''}
          </Text>
        ))}

        <Text bold>
          {'\n'}
          {say(`MCP 外接工具 ${c.mcp.length} 個`, `MCP servers: ${c.mcp.length}`)}
          {idleMcp.length > 0 ? say(`（久沒用 ${idleMcp.length} 個）`, ` (${idleMcp.length} unused)`) : ''}
        </Text>
        {c.mcp.map(r => (
          <Text key={`m${r.key}`} color={r.idle ? 'warning' : undefined}>
            {'  '}{r.idle ? '⚠ ' : ''}{r.label}: {say(`${r.count} 個工具`, `${r.count} tools`)}, {k(r.tokens)}
            {r.loadedTokens < r.tokens ? say(`（已載入 ${k(r.loadedTokens)}）`, ` (${k(r.loadedTokens)} loaded)`) : ''}
            {uses(r.uses, r.last)}
          </Text>
        ))}

        <Text bold>
          {'\n'}
          {say(`Skill ${c.skills.total} 個（列進提示 ${c.skills.included} 個，${k(c.skills.tokens)}）`, `Skills: ${c.skills.total} (${c.skills.included} listed in the prompt, ${k(c.skills.tokens)})`)}
          {c.skills.idleCount > 0 ? say(`，久沒用 ${c.skills.idleCount} 個`, `, ${c.skills.idleCount} unused`) : ''}
        </Text>
        {c.skills.rows.slice(0, 20).map(r => (
          <Text key={`s${r.key}`} color={r.idle ? 'warning' : undefined}>
            {'  '}{r.idle ? '⚠ ' : ''}{r.label}: {k(r.tokens)}{uses(r.uses, r.last)}
          </Text>
        ))}
        {c.skills.rows.length > 20 && (
          <Text dimColor>{'  '}{say(`…其餘 ${c.skills.rows.length - 20} 個較小`, `…${c.skills.rows.length - 20} smaller ones`)}</Text>
        )}

        <Text bold>{'\n'}{say(`記憶檔 ${c.memory.length} 個`, `Memory files: ${c.memory.length}`)}</Text>
        {c.memory.slice(0, 10).map((m, i) => (
          <Text key={`f${i}`}>{'  '}{m.path}: {k(m.tokens)}</Text>
        ))}

        <Text bold>{'\n'}{say(`自訂 agent ${c.agents.count} 個：${k(c.agents.tokens)}`, `Custom agents: ${c.agents.count}, ${k(c.agents.tokens)}`)}</Text>
        <Text dimColor>
          {'\n'}
          {say('只讀不改。想關掉哪個，直接跟 Claude 說「關掉 ○○」。', 'Read-only. To turn something off, ask Claude: "turn off …".')}
        </Text>
      </Box>
    )
  })
}

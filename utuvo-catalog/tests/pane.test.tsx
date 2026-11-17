import { expect, test } from 'claude-code/testing'

const BREAKDOWN = {
  categories: [{ name: 'System prompt', tokens: 3000, kind: 'used', isDeferred: false, color: 'x' }],
  totalTokens: 20000, maxTokens: 200000, percentage: 10,
  memoryFiles: [{ path: '/Users/x/.claude/CLAUDE.md', tokens: 900, type: 'User' }],
  mcpTools: [{ name: 'mcp__vercel__a', serverName: 'Vercel', tokens: 3000, isLoaded: false }],
  agents: [],
  skills: { totalSkills: 1, includedSkills: 1, tokens: 150, skillFrontmatter: [{ name: 'my-skill', source: 'userSettings', tokens: 150 }] },
}

const WORDS = {
  'zh-TW': { summary: 'MCP 1 個共 3.0k（最大：Vercel 3.0k）', head: /目前對話佔 20k/, row: /Vercel: 1 個工具, 3.0k.*用過 1 次/ },
  en: { summary: '1 MCP servers, 3.0k in all (largest: Vercel 3.0k)', head: /Context 20k tokens/, row: /Vercel: 1 tools, 3.0k.*used 1×/ },
} as const

for (const language of ['zh-TW', 'en'] as const) {
test(`/catalog opens the pane, lists MCP, skills, memory; a call is counted (${language})`, { options: { language } }, async ($, on) => {
  const W = WORDS[language]
  const store: Record<string, unknown> = { since: '2026-10-01T00:00:00.000Z' }
  on('env.get', () => ({ value: '/Users/x' }))
  on('clock.now', () => ({ value: Date.parse('2026-11-17T00:00:00Z') }))
  on('store.get', (_, e: any) => ({ value: store[e.key] }))
  on('store.set', (_, e: any) => { store[e.key] = e.value; return { value: undefined } })
  on('command.register', () => ({ value: { command: 'catalog' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { breakdown: BREAKDOWN }, rateLimits: [] } }))
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await ($.tool.call as any)({ tool: 'mcp__vercel__a', tool_use_id: 't1' })
  await ($.tool.call as any)({ tool: 'Skill', tool_use_id: 't2', skill: 'my-skill' })
  await new Promise(r => setTimeout(r, 20))
  expect((store.usage as any)?.['mcp:vercel']?.n).toBe(1)
  expect((store.usage as any)?.['skill:my-skill']?.n).toBe(1)

  const out: any = await $.command.run({ command: 'catalog', args: '' } as never)
  expect(String(out?.text)).toContain(W.summary)
  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({
      plugin: 'utuvo-catalog', component: 'Pane', requestId: 'utuvo-catalog', surface,
      props: { title: 'x', isFocused: false, bodyColumns: 90, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
    } as never)
    expect((await pane.find({ type: 'Text', text: W.head })) !== undefined).toBe(true)
    expect((await pane.find({ type: 'Text', text: W.row })) !== undefined).toBe(true)
    expect((await pane.find({ type: 'Text', text: /my-skill/ })) !== undefined).toBe(true)
    expect((await pane.find({ type: 'Text', text: /~\/.claude\/CLAUDE.md/ })) !== undefined).toBe(true)
    await pane.unmount()
  }
})
}

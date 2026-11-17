// node --experimental-strip-types tests/catalog.test.mjs
import { build, usageKey, serverKey, bump } from '../hooks/catalog.ts'
let bad = 0
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log('✗', name, got, '≠', want) } }

eq('serverKey', serverKey('mcp__ccd_session__start_session'), 'ccd_session')
eq('mcp key', usageKey('mcp__vercel__list_projects', {}), 'mcp:vercel')
eq('skill key', usageKey('Skill', { skill: 'my-skill' }), 'skill:my-skill')
eq('Bash 不記', usageKey('Bash', { command: 'ls' }), null)
eq('Skill 沒名字不記', usageKey('Skill', {}), null)

const B = {
  categories: [{ name: 'System prompt', tokens: 3000, kind: 'used' }, { name: 'Free space', tokens: 90000, kind: 'free' }, { name: 'MCP tools', tokens: 50000, kind: 'deferred', isDeferred: true }],
  totalTokens: 20000, maxTokens: 200000, percentage: 10,
  memoryFiles: [{ path: '/Users/x/.claude/CLAUDE.md', tokens: 900 }, { path: '/Users/x/big.md', tokens: 4000 }],
  mcpTools: [
    { name: 'mcp__vercel__a', serverName: 'Vercel', tokens: 300, isLoaded: false },
    { name: 'mcp__vercel__b', serverName: 'Vercel', tokens: 200, isLoaded: true },
    { name: 'mcp__gmail__a', serverName: 'Gmail', tokens: 100, isLoaded: false },
  ],
  agents: [{ tokens: 50 }, { tokens: 70 }],
  skills: { totalSkills: 2, includedSkills: 2, tokens: 160, skillFrontmatter: [{ name: 'small', tokens: 10 }, { name: 'big', tokens: 150 }] },
}
const usage = { 'mcp:gmail': { n: 3, last: '2026-11-16T00:00:00Z' }, 'skill:big': { n: 1, last: '2026-10-01T00:00:00Z' } }

// 剛開始記（觀察中）：一律不標久沒用
let c = build(B, usage, '2026-11-10T00:00:00Z', '2026-11-17T00:00:00Z', '/Users/x')
eq('觀察中', c.watching, true)
eq('觀察中不標', c.mcp.filter(r => r.idle).length, 0)
eq('free 不列', c.categories.map(x => x.name), ['System prompt', 'MCP tools'])
eq('deferred 標記', c.categories[1].deferred, true)
eq('MCP 依 token 排、合併同伺服器', c.mcp.map(r => [r.label, r.count, r.tokens, r.loadedTokens]), [['Vercel', 2, 500, 200], ['Gmail', 1, 100, 0]])
eq('skill 依 token 排', c.skills.rows.map(r => r.key), ['big', 'small'])
eq('記憶檔縮 ~', c.memory.map(m => m.path), ['~/big.md', '~/.claude/CLAUDE.md'])
eq('agents', c.agents, { count: 2, tokens: 120 })

// 記滿 14 天：沒用過、或超過 14 天沒用 → 久沒用；最近用過 → 不標
c = build(B, usage, '2026-10-01T00:00:00Z', '2026-11-17T00:00:00Z', '/Users/x')
eq('vercel 沒用過→久沒用', c.mcp.find(r => r.key === 'vercel').idle, true)
eq('gmail 昨天用過→不標', c.mcp.find(r => r.key === 'gmail').idle, false)
eq('skill big 47 天前→久沒用', c.skills.rows.find(r => r.key === 'big').idle, true)
eq('久沒用 skill 數', c.skills.idleCount, 2)

eq('bump', bump({ 'mcp:a': { n: 2, last: 'x' } }, 'mcp:a', 'y'), { 'mcp:a': { n: 3, last: 'y' } })
console.log(bad === 0 ? 'OK' : `錯 ${bad} 條`)
process.exit(bad === 0 ? 0 : 1)

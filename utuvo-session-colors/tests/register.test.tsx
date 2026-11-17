import { expect, mock, test } from 'claude-code/testing'
import type { ThemeSetArgs } from 'claude-code'

import { checkColors } from '../hooks/make-colors.js'
import { LINE_KEYS, paletteFor, pickLine, sceneFor } from '../hooks/palette'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const
const SESS = '/Users/t/Library/Application Support/Claude/claude-code-sessions'

test('pickLine：開頭的 🔥／🌸 不影響判色', () => {
  expect(pickLine('🔥 🟦 基建-EP09')).toBe('blue')
  expect(pickLine('🔥🟨 官網-EP13')).toBe('yellow')
  expect(pickLine('🌸 🟪 小App')).toBe('purple')
  expect(pickLine('🟥 Pro')).toBe('red')
  expect(pickLine('⬜ 個人')).toBe('white')
  expect(pickLine('🔥 沒有色塊')).toBe('default')
  expect(pickLine('')).toBe('default')
})

test('17 套配色桌面版都畫得出來', () => {
  expect(LINE_KEYS.length).toBe(17)
  for (const key of LINE_KEYS) {
    const { theme, problems } = paletteFor(key)
    expect(problems.filter(p => p.startsWith("Desktop won't paint"))).toEqual([])
    expect(checkColors(theme).filter(p => !/it needs \d+(\.\d+)?:1/.test(p))).toEqual([])
  }
})

test('night sky: five bright stars; working adds a breathing glow, idle has none', () => {
  for (const key of LINE_KEYS) {
    for (const live of [false, true]) {
      const svg = sceneFor(key, live)
      expect(svg.split('data-bright-star').length - 1).toBe(5)
      expect(svg.includes('class="live"')).toBe(live)
      expect(svg.includes('<script')).toBe(false)
      expect(svg.split('http').length - 1).toBe(1)
    }
  }
  expect(sceneFor('purple', true)).toContain('#a48bf0')
})

type Stage = { title: string; sets: ThemeSetArgs[]; cleared: number }

function stage(on: Parameters<typeof mock.store>[0], title: string): Stage {
  const stand: Stage = { title, sets: [], cleared: 0 }
  mock.env(on, { HOME: '/Users/t', CLAUDE_CODE_HOST_SESSION_ID: 'abc' })
  on('command.register', () => ({ value: { command: 'session-colors' } }))
  on('fs.exists', (_, e) => ({ value: e.path === SESS || e.path === `${SESS}/u/w/abc.json` }))
  on('fs.list', (_, e) => {
    if (e.path === SESS) return { value: [{ name: 'u', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
    return { value: [{ name: 'w', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] }
  })
  on('fs.read', (_, e) => {
    if (e.path !== `${SESS}/u/w/abc.json`) throw new Error('unexpected read ' + e.path)
    return { value: JSON.stringify({ title: stand.title }) }
  })
  on('theme.set', (_, e) => {
    stand.sets.push(e)
    return { value: { isDrawn: true, requestId: 'r' } }
  })
  on('theme.clear', () => {
    stand.cleared += 1
    return { value: { isDrawn: false, reason: 'cleared' } }
  })
  on('clock.every', () => ({ value: { cancel: () => undefined } }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return stand
}

test('reads the desktop title: 🔥 🟦 → blue working sky; 🟨 → yellow; off clears', { options: { language: 'zh-TW' } }, async ($, on) => {
  mock.store(on)
  const stand = stage(on, '🔥 🟦 基建-EP09')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(stand.sets.at(-1)?.backdrop).toMatchObject({ scene: 'ucolors-blue-live' })

  stand.title = '🟨 官網-EP13'
  const on1 = await $.command.run({ command: 'session-colors', args: 'on', ...RUN })
  expect(stand.sets.at(-1)?.backdrop).toMatchObject({ scene: 'ucolors-yellow' })
  expect(on1.text).toContain('🟨（黃）')

  const off = await $.command.run({ command: 'session-colors', args: 'off', ...RUN })
  expect(stand.cleared).toBe(1)
  expect(off.text).toContain('已關掉')

  const bd = await $.ui.mount({
    plugin: 'utuvo-session-colors', component: 'Backdrop', surface: 'desktop',
    props: { scene: 'ucolors-blue-live', plugin: 'utuvo-session-colors', glass: { blur: 14, tint: '#000000', opacity: 0.55 } },
  } as never)
  expect(await bd.find({ type: 'Svg' })).toBeDefined()
  await bd.unmount()
})

test('English command text', { options: { language: 'en' } }, async ($, on) => {
  mock.store(on)
  const stand = stage(on, '🟪 side project')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.command.run({ command: 'session-colors', args: 'on', ...RUN })
  expect(r.text).toContain('Session colors are on: 🟪 (purple)')
  expect(stand.sets.at(-1)?.backdrop).toMatchObject({ scene: 'ucolors-purple' })
})

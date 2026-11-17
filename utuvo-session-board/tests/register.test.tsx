import { expect, mock, test } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

import { buildBoard, formatElapsed } from '../hooks/board'
import type { Entry } from '../hooks/board'

const RUN = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
} as const

const BAND = {
  plugin: 'utuvo-session-board',
  component: 'AbovePrompt',
  requestId: 'session-board',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const NOW = 1_000_000_000

function entry(id: string, status: string, ageMs: number, name?: string, kind = 'interactive'): Entry {
  return { sessionId: id, name, status, statusUpdatedAt: NOW - ageMs, kind }
}

test('S1 formatElapsed', () => {
  expect(formatElapsed(0)).toBe('剛開始')
  expect(formatElapsed(59999)).toBe('剛開始')
  expect(formatElapsed(60000)).toBe('已跑 1 分鐘')
  expect(formatElapsed(3599999)).toBe('已跑 59 分鐘')
  expect(formatElapsed(3600000)).toBe('已跑 1 小時 0 分')
  expect(formatElapsed(10800000)).toContain('已跑 3 小時 0 分')
  expect(formatElapsed(10800000)).toContain('可能卡住了')
  expect(formatElapsed(-5)).toBe('剛開始')
  expect(formatElapsed(Number.NaN)).toBe('剛開始')
})

test('S2 buildBoard: counts, order, self mark, names', () => {
  const long = 'あ'.repeat(40)
  const board = buildBoard(
    [
      entry('a', 'busy', 60000, 'newest'),
      entry('b', 'busy', 600000, 'oldest'),
      entry('me', 'busy', 300000, '  🟦 mine  '),
      entry('c', 'idle', 1000, 'idle one'),
      entry('d', 'waiting', 1000, 'idle two'),
      entry('e', 'busy', 1000, 'not interactive', 'background'),
    ],
    NOW,
    'me',
  )

  expect(board.busyCount).toBe(3)
  expect(board.idleCount).toBe(2)
  expect(board.lines[0]).toContain('oldest')
  expect(board.lines[1]).toContain('🟦 mine')
  expect(board.lines[1]).toContain('（就是這個）')
  expect(board.lines[2]).toContain('newest')
  expect(board.lines[0]).toContain('　已跑 10 分鐘')

  const unnamed = buildBoard([entry('x', 'busy', 0), entry('y', 'busy', 0, '   '), entry('z', 'busy', 0, long)], NOW, 'q')

  expect(unnamed.lines.filter(line => line.includes('（未命名 Session）')).length).toBe(2)
  expect(unnamed.lines.some(line => line.includes(`${'あ'.repeat(27)}…`) && !line.includes('あ'.repeat(28)))).toBe(true)
})

test('S3 buildBoard: at most 5 lines, the rest counted', () => {
  const entries = Array.from({ length: 7 }, (_, index) => entry(`s${index}`, 'busy', index * 1000))
  const board = buildBoard(entries, NOW, 'none')

  expect(board.lines.length).toBe(5)
  expect(board.more).toBe(2)
  expect(board.busyCount).toBe(7)
})

// Stands for the engine's state: answers every `state.get` from a plain record.
const stand = (values: Record<string, unknown>) => (_: unknown, e: { key: string }) => ({
  value: { value: values[e.key], version: 1 },
})

test('S4 band: busy shows the running line, none busy says so, no data says loading', { options: { language: 'zh-TW' } }, async ($, on) => {
  on(
    'state.get',
    stand({
      isOn: true,
      board: { busyCount: 2, idleCount: 1, lines: ['• 甲　剛開始', '• 乙　已跑 5 分鐘'], more: 0 },
    }),
  )

  const busy = await $.ui.mount({ ...BAND })

  expect((await busy.find({ type: 'Text', text: /正在執行/ }))?.text).toContain('正在執行 2 個 Session（另有 1 個閒置）')
  expect(await busy.find({ type: 'Text', text: /乙/ })).toBeDefined()
  await busy.unmount()
})

test('S4b band: nothing busy', { options: { language: 'zh-TW' } }, async ($, on) => {
  on('state.get', stand({ isOn: true, board: { busyCount: 0, idleCount: 4, lines: [], more: 0 } }))

  const none = await $.ui.mount({ ...BAND })

  expect((await none.find({ type: 'Text', text: /目前沒有 Session 在執行/ }))?.text).toContain('（4 個閒置）')
  await none.unmount()
})

test('S4c band: no data yet, and the more row', { options: { language: 'zh-TW' } }, async ($, on) => {
  on('state.get', stand({ isOn: true }))

  const loading = await $.ui.mount({ ...BAND })

  expect(await loading.find({ type: 'Text', text: /讀取中/ })).toBeDefined()
  await loading.unmount()
})

test('S4d band: more row', { options: { language: 'zh-TW' } }, async ($, on) => {
  on('state.get', stand({ isOn: true, board: { busyCount: 7, idleCount: 0, lines: ['• a', '• b', '• c', '• d', '• e'], more: 2 } }))

  const more = await $.ui.mount({ ...BAND })

  expect(await more.find({ type: 'Text', text: /還有 2 個/ })).toBeDefined()
  await more.unmount()
})

test('S5 /session-board off, on, and no argument', { options: { language: 'zh-TW' } }, async ($, on) => {
  const stored: Record<string, unknown> = {}
  const states: Record<string, unknown> = {}

  on('store.set', (_, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('state.set', (_, e) => {
    states[e.key] = e.value

    return { value: { isSet: true, version: 1 } }
  })
  on('state.get', (_, e) => ({ value: { value: states[e.key], version: 1 } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const off = await $.command.run({ command: 'session-board', args: ' OFF ', ...RUN })

  expect(stored.enabled).toBe(false)
  expect(off.text).toContain('已關閉')

  // Off: the band hands on to the engine and draws nothing of its own.
  const band = await $.ui.mount({ ...BAND })

  expect((await band.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  expect(await band.find({ type: 'Text', text: /讀取中/ })).toBeUndefined()
  await band.unmount()

  const status = await $.command.run({ command: 'session-board', args: '', ...RUN })

  expect(status.text).toContain('目前：關閉')
  expect(status.text).toContain('用法')

  const turnedOn = await $.command.run({ command: 'session-board', args: 'on', ...RUN })

  expect(stored.enabled).toBe(true)
  expect(turnedOn.text).toContain('已開啟')

  const unknown = await $.command.run({ command: 'session-board', args: 'what', ...RUN })

  expect(unknown.text).toContain('看不懂')
})

test('S6 only <digits>.json files are read, never a key file', { options: { language: 'zh-TW' } }, async ($, on) => {
  const reads: string[] = []
  const written: unknown[] = []

  on('command.register', () => ({ value: { command: 'session-board' } }))
  on('store.get', () => ({ value: undefined }))
  on('state.set', (_, e) => {
    written.push(e.value)

    return { value: { isSet: true, version: 1 } }
  })
  on('env.get', () => ({ value: '/home/test' }))
  on('session.id', () => ({ value: 'me' }))
  on('clock.now', () => ({ value: NOW }))
  on('fs.list', () => ({
    value: ['123.json', '123.abc.key', 'x.json', 'notes.txt'].map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('fs.read', (_, e) => {
    reads.push(e.path)

    return { value: JSON.stringify({ sessionId: 'me', name: 'n', status: 'busy', statusUpdatedAt: NOW, kind: 'interactive' }) }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect(reads).toEqual(['/home/test/.claude/sessions/123.json'])
  expect(reads.some(path => path.endsWith('.key'))).toBe(false)
  expect(written.length).toBeGreaterThan(0)
})

type Rig = { reads: string[]; lists: number; states: Record<string, unknown>; stored: Record<string, unknown> }

type RigOptions = { home?: string; list?: FsEntry[]; files?: Record<string, string> }

// Stands for the engine under the mod: real state and store records, a folder listing, and file contents.
function rig(on: Parameters<typeof mock.clock>[0], options: RigOptions): Rig {
  const held: Rig = { reads: [], lists: 0, states: {}, stored: {} }

  on('command.register', () => ({ value: { command: 'session-board' } }))
  on('store.get', (_, e) => ({ value: held.stored[e.key] }))
  on('store.set', (_, e) => {
    held.stored[e.key] = e.value

    return { value: undefined }
  })
  on('state.set', (_, e) => {
    held.states[e.key] = e.value

    return { value: { isSet: true, version: 1 } }
  })
  on('state.get', (_, e) => ({ value: { value: held.states[e.key], version: 1 } }))
  on('env.get', () => ({ value: options.home }))
  on('session.id', () => ({ value: 'me' }))
  on('fs.list', () => {
    held.lists += 1

    return { value: options.list ?? [] }
  })
  on('fs.read', (_, e) => {
    held.reads.push(e.path)

    return { value: options.files?.[e.path] ?? '{}' }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  return held
}

const file = (name: string, extra: Partial<FsEntry> = {}): FsEntry => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false, ...extra })

const busyJson = (id: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ sessionId: id, name: `n${id}`, status: 'busy', statusUpdatedAt: NOW - 1000, kind: 'interactive', ...extra })

const START = { cwd: '/', surface: 'desktop', isInteractive: true } as const

test('S7 seven busy sessions draw exactly seven Text rows', { options: { language: 'zh-TW' } }, async ($, on) => {
  const list = Array.from({ length: 7 }, (_, index) => file(`${index + 1}.json`))
  const files = Object.fromEntries(list.map((item, index) => [`/h/.claude/sessions/${item.name}`, busyJson(`s${index}`, { statusUpdatedAt: NOW - index * 1000 })]))

  mock.clock(on)
  rig(on, { home: '/h', list, files })

  await $.session.start({ ...START })

  const band = await $.ui.mount({ ...BAND })
  const rows = await band.findAll({ type: 'Text' })

  expect(rows.length).toBe(7)
  expect(rows[0]?.text).toContain('正在執行 7 個 Session')
  expect(rows[6]?.text).toContain('還有 2 個')
  await band.unmount()
})

test('S8 off stops all reads, on reads again at once', { options: { language: 'zh-TW' } }, async ($, on) => {
  const clock = mock.clock(on)
  const held = rig(on, { home: '/h', list: [file('1.json')], files: { '/h/.claude/sessions/1.json': busyJson('a') } })

  await $.session.start({ ...START })
  await $.command.run({ command: 'session-board', args: 'off', ...RUN })

  const listsBefore = held.lists
  const readsBefore = held.reads.length

  await clock.advance(20000)

  expect(held.lists).toBe(listsBefore)
  expect(held.reads.length).toBe(readsBefore)

  await $.command.run({ command: 'session-board', args: 'on', ...RUN })

  expect(held.lists).toBeGreaterThan(listsBefore)
  expect(held.reads.length).toBeGreaterThan(readsBefore)
})

test('S9 no HOME: nothing is listed or read, no state written', { options: { language: 'zh-TW' } }, async ($, on) => {
  const clock = mock.clock(on)
  const held = rig(on, { home: undefined, list: [file('1.json')] })

  await $.session.start({ ...START })
  await clock.advance(10000)

  expect(held.lists).toBe(0)
  expect(held.reads).toEqual([])
  expect(held.states.board).toBeUndefined()
})

test('S9b empty HOME is treated like a missing one', { options: { language: 'zh-TW' } }, async ($, on) => {
  mock.clock(on)

  const held = rig(on, { home: '', list: [file('1.json')] })

  await $.session.start({ ...START })

  expect(held.lists).toBe(0)
  expect(held.reads).toEqual([])
})

test('S10 a text timestamp sorts last and reads as just started', () => {
  const bad = { sessionId: 'bad', name: 'bad one', status: 'busy', statusUpdatedAt: 'x' as unknown as number, kind: 'interactive' }
  const board = buildBoard([entry('a', 'busy', 60000, 'newer'), bad, entry('b', 'busy', 600000, 'older')], NOW, 'q')

  expect(board.lines.length).toBe(3)
  expect(board.lines[0]).toContain('older')
  expect(board.lines[1]).toContain('newer')
  expect(board.lines[2]).toContain('bad one')
  expect(board.lines[2]).toContain('剛開始')
})

test('S11 truncation counts an emoji as one character', () => {
  const board = buildBoard([entry('a', 'busy', 0, '🟦'.repeat(30))], NOW, 'q')

  expect(board.lines[0]).toContain(`${'🟦'.repeat(27)}…`)
  expect(board.lines[0]).not.toContain('🟦'.repeat(28))
})

test('S12 only plain files are read, not links or folders', { options: { language: 'zh-TW' } }, async ($, on) => {
  mock.clock(on)

  const held = rig(on, {
    home: '/h',
    list: [file('1.json'), file('2.json', { isLink: true }), file('3.json', { kind: 'dir' })],
    files: { '/h/.claude/sessions/1.json': busyJson('a') },
  })

  await $.session.start({ ...START })

  expect(held.reads).toEqual(['/h/.claude/sessions/1.json'])
})

test('S13 a survey takes the row', { options: { language: 'zh-TW' } }, async ($, on) => {
  on('state.get', stand({ isOn: true, board: { busyCount: 1, idleCount: 0, lines: ['• a'], more: 0 } }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const band = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true } })

  expect((await band.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  expect(await band.find({ type: 'Text', text: /正在執行/ })).toBeUndefined()
  await band.unmount()
})

test('English band and commands', { options: { language: 'en' } }, async ($, on) => {
  mock.store(on)
  mock.env(on, { HOME: '/home/test' })
  on('session.id', () => ({ value: 'me' }))
  on('command.register', () => ({ value: { command: 'session-board' } }))
  on('clock.now', () => ({ value: 1_000_000_000 }))
  on('clock.every', () => ({ value: { cancel: () => undefined } }) as never)
  on('fs.list', () => ({ value: [{ name: '1.json', kind: 'file', size: 1, mtimeMs: 0, isLink: false }] }))
  on('fs.read', () => ({ value: JSON.stringify({ sessionId: 'x', name: 'Build the site', status: 'busy', statusUpdatedAt: 1_000_000_000 - 600_000, kind: 'interactive' }) }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const band = await $.ui.mount({ plugin: 'utuvo-session-board', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false } } as never)
  expect((await band.find({ type: 'Text', text: /1 sessions running/ })) !== undefined).toBe(true)
  expect((await band.find({ type: 'Text', text: /Build the site  running 10 min/ })) !== undefined).toBe(true)
  await band.unmount()
  const off = await $.command.run({ command: 'session-board', args: 'off', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as never)
  expect(String((off as any).text)).toContain('band is off')
})

import { expect, test } from 'claude-code/testing'
import type { mock } from 'claude-code/testing'

const RUN = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 80 },
} as const

const ZH = { options: { language: 'zh-TW' } } as const

const HIDDEN_CMD = 'rm -rf /tmp/hidden-xyz'

const SURFACES = ['desktop', 'mobile'] as const

const toolUse = (surface: 'desktop' | 'mobile' | 'terminal' | 'vscode', props: Record<string, unknown> = {}) =>
  ({
    plugin: 'utuvo-quiet-tools',
    component: 'ToolUse',
    requestId: 'toolu_1',
    surface,
    props: {
      tool_use_id: 'toolu_1',
      tool: 'Bash',
      input: { command: HIDDEN_CMD },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      isExpanded: false,
      ...props,
    },
  }) as const

const call = (extra: Record<string, unknown> = {}) => ({
  tool: 'Bash',
  input: { command: HIDDEN_CMD },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  ...extra,
})

const toolGroup = (surface: 'desktop' | 'mobile', props: Record<string, unknown> = {}) =>
  ({
    plugin: 'utuvo-quiet-tools',
    component: 'ToolGroup',
    requestId: 'group_1',
    surface,
    props: {
      calls: [call(), call(), call()],
      isActive: false,
      isExpanded: false,
      isCallsOnly: true,
      ...props,
    },
  }) as const

// The engine's own drawing, which a mod leaves by calling next.
function engine(on: Parameters<typeof mock.clock>[0], stored?: Record<string, unknown>) {
  // The store: empty unless the test hands one in, so the switch is on by default.
  on('store.get', (_, e) => ({ value: stored?.[e.key] }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
}

test('Q1 ToolUse: finished, no error, not expanded draws nothing and leaks no command', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolUse(surface) as never)

    expect((await ui.findAll({ type: 'Text' })).length).toBe(0)
    expect(await ui.find({ type: 'Text', text: /hidden-xyz/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('Q2 ToolUse: running draws one dim line', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolUse(surface, { isRunning: true }) as never)
    const rows = await ui.findAll({ type: 'Text' })

    expect(rows.length).toBe(1)
    expect(rows[0]?.text).toBe('⋯ 執行中')
    expect(rows[0]?.props.dimColor).toBe(true) // Q2b
    expect(await ui.find({ type: 'Text', text: /hidden-xyz/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('Q3 ToolUse: errored and interrupted go to the engine', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    for (const props of [{ isErrored: true }, { isInterrupted: true }]) {
      const ui = await $.ui.mount(toolUse(surface, props) as never)

      expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
      await ui.unmount()
    }
  }
})

test('Q4 ToolUse: expanded goes to the engine', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolUse(surface, { isExpanded: true }) as never)

    expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
    await ui.unmount()
  }
})

test('Q5 ToolUse: terminal and vscode go to the engine', ZH, async ($, on) => {
  engine(on)

  for (const surface of ['terminal', 'vscode'] as const) {
    const ui = await $.ui.mount(toolUse(surface) as never)

    expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
    await ui.unmount()
  }
})

test('Q6 ToolGroup: three finished calls draw nothing', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolGroup(surface) as never)

    expect((await ui.findAll({ type: 'Text' })).length).toBe(0)
    expect(await ui.find({ type: 'Text', text: /hidden-xyz/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('Q7 ToolGroup: active group draws one dim line with the count', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolGroup(surface, { isActive: true }) as never)
    const rows = await ui.findAll({ type: 'Text' })

    expect(rows.length).toBe(1)
    expect(rows[0]?.text).toBe('⋯ 執行中（3 個步驟）')
    expect(rows[0]?.props.dimColor).toBe(true) // Q7b
    await ui.unmount()

    const running = await $.ui.mount(toolGroup(surface, { calls: [call(), call({ isRunning: true }), call()] }) as never)

    const runningRows = await running.findAll({ type: 'Text' })

    expect(runningRows.length).toBe(1) // Q7b
    expect(runningRows[0]?.text).toBe('⋯ 執行中（3 個步驟）')
    expect(runningRows[0]?.props.dimColor).toBe(true)
    await running.unmount()
  }
})

test('Q8 ToolGroup: errors, mixed content and expanded go to the engine', ZH, async ($, on) => {
  engine(on)

  const cases = [
    { calls: [call(), call({ isErrored: true }), call()] },
    { calls: [call(), call({ isInterrupted: true })] },
    { isCallsOnly: false },
    { isExpanded: true },
  ]

  for (const surface of SURFACES) {
    for (const props of cases) {
      const ui = await $.ui.mount(toolGroup(surface, props) as never)

      expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
      await ui.unmount()
    }
  }
})

test('Q9 /quiet-tools off, on, no argument, and nonsense', ZH, async ($, on) => {
  const stored: Record<string, unknown> = {}

  on('store.set', (_, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  engine(on, stored)

  const off = await $.command.run({ command: 'quiet-tools', args: ' OFF ', ...RUN })

  expect(stored.enabled).toBe(false)
  expect(off.text).toContain('已關閉')

  const shown = await $.ui.mount(toolUse('desktop') as never)

  expect((await shown.find({ type: 'Text' }))?.text).toBe('engine')
  await shown.unmount()

  const status = await $.command.run({ command: 'quiet-tools', args: '', ...RUN })

  expect(status.text).toContain('目前：關閉')
  expect(status.text).toContain('用法')

  const turnedOn = await $.command.run({ command: 'quiet-tools', args: 'on', ...RUN })

  expect(stored.enabled).toBe(true)
  expect(turnedOn.text).toContain('已開啟')

  const hidden = await $.ui.mount(toolUse('desktop') as never)

  expect((await hidden.findAll({ type: 'Text' })).length).toBe(0)
  await hidden.unmount()

  const unknown = await $.command.run({ command: 'quiet-tools', args: 'what', ...RUN })

  expect(unknown.text).toContain('看不懂')
})

test('Q10 ToolGroup: terminal and vscode go to the engine', ZH, async ($, on) => {
  engine(on)

  for (const surface of ['terminal', 'vscode'] as const) {
    const ui = await $.ui.mount({ ...toolGroup('desktop'), surface } as never)

    expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
    await ui.unmount()
  }
})

test('Q11 ToolGroup: after /quiet-tools off, a finished group goes to the engine', ZH, async ($, on) => {
  const stored: Record<string, unknown> = {}

  on('store.set', (_, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })
  engine(on, stored)

  await $.command.run({ command: 'quiet-tools', args: 'off', ...RUN })

  for (const surface of SURFACES) {
    const ui = await $.ui.mount(toolGroup(surface) as never)

    expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
    await ui.unmount()
  }
})

test('Q12 ToolGroup: isCallsOnly missing is judged by the calls themselves', ZH, async ($, on) => {
  engine(on)

  for (const surface of SURFACES) {
    const { isCallsOnly: _omit, ...rest } = toolGroup(surface).props
    const base = { ...toolGroup(surface), props: rest }

    const quiet = await $.ui.mount(base as never)

    expect((await quiet.findAll({ type: 'Text' })).length).toBe(0)
    await quiet.unmount()

    const errored = await $.ui.mount({ ...base, props: { ...rest, calls: [call(), call({ isErrored: true }), call()] } } as never)

    expect((await errored.find({ type: 'Text' }))?.text).toBe('engine')
    await errored.unmount()
  }
})

test('Q13 /quiet-tools off tells the person to reopen the conversation', ZH, async ($, on) => {
  engine(on)
  on('store.set', () => ({ value: undefined }))

  const off = await $.command.run({ command: 'quiet-tools', args: 'off', ...RUN })

  expect(off.text).toContain('重新打開這個對話')
})

test('Q14 English: running line and command replies', { options: { language: 'en' } }, async ($, on) => {
  engine(on)
  on('store.set', () => ({ value: undefined }))
  const ui = await $.ui.mount(toolUse('desktop', { isRunning: true }) as never)
  expect((await ui.find({ type: 'Text' }))?.text).toBe('⋯ running')
  await ui.unmount()
  const off = await $.command.run({ command: 'quiet-tools', args: 'off', ...RUN })
  expect(off.text).toContain('Quiet tools is off')
})

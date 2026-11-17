import { expect, mock, test } from 'claude-code/testing'

const OUT = `[Parsed_ebur128_0] Summary:

  Integrated loudness:
    I:         -18.2 LUFS
    Threshold: -28.4 LUFS

  Loudness range:
    LRA:         5.3 LU
    Threshold:   -38.3 LUFS
    LRA low:     -21.0 LUFS
    LRA high:    -15.7 LUFS

  True peak:
    Peak:       -1.4 dBFS`

const row = (output: unknown, surface: 'terminal' | 'desktop' | 'mobile') =>
  ({
    plugin: 'utuvo-loudness',
    component: 'ToolUse',
    requestId: 't1',
    surface,
    props: { tool_use_id: 't1', tool: 'Bash', input: { command: 'ffmpeg …' }, isRunning: false, isErrored: false, isInterrupted: false, output },
  }) as const

test('有 ebur128 Summary 就畫響度卡，Atmos Music 打勾', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>原本那一列</Text>
  })
  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount(row({ stdout: '', stderr: OUT }, surface))
    expect((await ui.find({ type: 'Text', text: /原本那一列/ }))?.text).toBe('原本那一列')
    expect((await ui.find({ type: 'Text', text: /Integrated -18\.2 LUFS/ })) !== undefined).toBe(true)
    expect((await ui.find({ type: 'Text', text: /✓ Atmos Music/ })) !== undefined).toBe(true)
    await ui.unmount()
  }
})

test('一般指令輸出不畫卡', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>原本那一列</Text>
  })
  const ui = await $.ui.mount(row({ stdout: 'total 8\nfoo.wav', stderr: '' }, 'desktop'))
  expect((await ui.find({ type: 'Text', text: /Integrated/ })) === undefined).toBe(true)
  await ui.unmount()
})

for (const [language, diff, source] of [['en', /off by -0\.2 LU/, /Source:/], ['zh-TW', /差 -0\.2 LU/, /來源：/]] as const) {
  test(`card text follows the language option (${language})`, { options: { language } }, async ($, on) => {
    mock.env(on, {})
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('ui.render', ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>row</Text>
    })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount(row({ stdout: '', stderr: OUT }, 'desktop'))
    expect((await ui.find({ type: 'Text', text: diff })) !== undefined).toBe(true)
    expect((await ui.find({ type: 'Text', text: source })) !== undefined).toBe(true)
    await ui.unmount()
  })
}

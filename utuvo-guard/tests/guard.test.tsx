import { expect, mock, test } from 'claude-code/testing'

for (const [language, word] of [['en', 'Blocked by utuvo-guard'], ['zh-TW', '防呆閘（utuvo-guard）擋下']] as const) {
  test(`blocks a known mistake and explains it (${language})`, { options: { language } }, async ($, on) => {
    mock.env(on, { HOME: '/Users/t' })
    on('fs.exists', () => ({ value: false }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '' } }))
    on('clock.now', () => ({ value: 0 }))
    on('tool.call', () => ({ result: { text: 'ran' } }) as never)
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

    const bad: any = await ($.tool.call as any)({ tool: 'Bash', tool_use_id: 'b1', command: 'wrangler r2 object get b/k --file k' })
    expect(JSON.stringify(bad)).toContain(word)
    const fine: any = await ($.tool.call as any)({ tool: 'Bash', tool_use_id: 'b2', command: 'wrangler r2 object get b/k --file k --remote' })
    expect(JSON.stringify(fine)).toContain('ran')
    const master: any = await ($.tool.call as any)({ tool: 'Bash', tool_use_id: 'b3', command: 'rm ~/Album/Masters/a.wav' })
    expect(JSON.stringify(master)).toContain(word)
  })
}

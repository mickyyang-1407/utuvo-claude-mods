import { expect, mock, test } from 'claude-code/testing'

for (const [language, word] of [['en', 'Blocked by utuvo-guard'], ['zh-TW', '防呆閘（utuvo-guard）擋下']] as const) {
  test(`blocks a known mistake and explains it (${language})`, { options: { language } }, async ($, on) => {
    mock.env(on, { HOME: '/Users/t' })
    on('fs.exists', () => ({ value: false }))
    on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
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

test('protects a folder from the protectedFolders option and stops rm -rf ~', { options: { language: 'en', protectedFolders: '~/Pictures/Library, ~/Thesis' } }, async ($, on) => {
  mock.env(on, { HOME: '/Users/t' })
  on('fs.exists', () => ({ value: false }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('clock.now', () => ({ value: 0 }))
  on('tool.call', () => ({ result: { text: 'ran' } }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  const thesis: any = await ($.tool.call as any)({ tool: 'Bash', tool_use_id: 'c1', command: 'rm ~/Thesis/draft-v3.docx' })
  expect(JSON.stringify(thesis)).toContain('Blocked by utuvo-guard')
  const edit: any = await ($.tool.call as any)({ tool: 'Write', tool_use_id: 'c2', file_path: '/Users/t/Pictures/Library/a.jpg', content: '' })
  expect(JSON.stringify(edit)).toContain('Blocked by utuvo-guard')
  const home: any = await ($.tool.call as any)({ tool: 'Bash', tool_use_id: 'c3', command: 'rm -rf ~' })
  expect(JSON.stringify(home)).toContain('rm')
  expect(JSON.stringify(home)).toContain('Blocked by utuvo-guard')
  const copy: any = await ($.tool.call as any)({ tool: 'Bash', tool_use_id: 'c4', command: 'cp ~/Thesis/draft-v3.docx /tmp/' })
  expect(JSON.stringify(copy)).toContain('ran')
})

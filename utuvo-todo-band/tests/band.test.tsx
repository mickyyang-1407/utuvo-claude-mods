import { expect, test } from 'claude-code/testing'

const MD = `## Today
- [x] done thing
- [ ] **Reply to the label** about the cover
- [ ] 2026-11-17 Book the studio
## Later
- [ ] Update the website
`
const PANE_PROPS = { title: 'x', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} }

function setup(on: any, files: Record<string, string>) {
  on('env.get', (_: unknown, e: any) => ({ value: e.name === 'HOME' ? '/Users/a' : undefined }))
  on('fs.exists', (_: unknown, e: any) => ({ value: String(e.path) in files }))
  on('fs.read', (_: unknown, e: any) => ({ value: files[String(e.path)] ?? '' }))
  on('command.register', () => ({ value: { command: 'todo-band' } }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('clock.every', () => ({ value: { cancel() {} } }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
}

for (const [language, band, list] of [['en', /3 open/, 'Update the website'], ['zh-TW', /待辦 3 件/, 'Update the website']] as const) {
  test(`band and pane read TODO.md in the project folder (${language})`, { options: { language } }, async ($, on) => {
    setup(on, { '/w/proj/TODO.md': MD, '/Users/a/TODO.md': '- [ ] home one' })
    await $.session.start({ cwd: '/w/proj', surface: 'desktop', isInteractive: true })
    for (const surface of ['terminal', 'desktop'] as const) {
      const b = await $.ui.mount({ plugin: 'utuvo-todo-band', component: 'AbovePrompt', surface, props: { hasSurvey: false } } as never)
      expect((await b.find({ type: 'Text', text: band })) !== undefined).toBe(true)
      expect((await b.find({ type: 'Text', text: /Reply to the label/ })) !== undefined).toBe(true)
      await b.unmount()
      const p = await $.ui.mount({ plugin: 'utuvo-todo-band', component: 'Pane', requestId: 'utuvo-todo', surface, props: PANE_PROPS } as never)
      expect((await p.find({ type: 'Text', text: new RegExp(list) })) !== undefined).toBe(true)
      expect((await p.find({ type: 'Text', text: /Later/ })) !== undefined).toBe(true)
      await p.unmount()
    }
  })
}

test('falls back to ~/TODO.md, and draws nothing when there is no file', { options: { language: 'en' } }, async ($, on) => {
  setup(on, { '/Users/a/TODO.md': '- [ ] home one' })
  await $.session.start({ cwd: '/w/empty', surface: 'desktop', isInteractive: true })
  const b = await $.ui.mount({ plugin: 'utuvo-todo-band', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false } } as never)
  expect((await b.find({ type: 'Text', text: /home one/ })) !== undefined).toBe(true)
  await b.unmount()
})

test('uses the file option', { options: { language: 'en', file: '~/Notes/todo.md' } }, async ($, on) => {
  setup(on, { '/Users/a/Notes/todo.md': '- [ ] from the option', '/w/p/TODO.md': '- [ ] not this' })
  await $.session.start({ cwd: '/w/p', surface: 'desktop', isInteractive: true })
  const b = await $.ui.mount({ plugin: 'utuvo-todo-band', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false } } as never)
  expect((await b.find({ type: 'Text', text: /from the option/ })) !== undefined).toBe(true)
  await b.unmount()
})

import { expect, mock, test } from 'claude-code/testing'

const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

for (const [language, word] of [['en', 'Chimes are off'], ['zh-TW', '提示音已關掉']] as const) {
  test(`/chime off and test (${language})`, { options: { language } }, async ($, on) => {
    mock.store(on)
    mock.env(on, {})
    const played: string[] = []
    on('command.register', () => ({ value: { command: 'chime' } }))
    on('audio.play', (_, e: any) => { played.push(e.clip.asset); return { value: undefined } })
    on('clock.sleep', () => ({ value: undefined }))
    on('clock.now', () => ({ value: 0 }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const off = await $.command.run({ command: 'chime', args: 'off', ...RUN })
    expect(off.text).toContain(word)
    await $.command.run({ command: 'chime', args: 'test', ...RUN })
    expect(played).toEqual(['sounds/done.wav', 'sounds/waiting.wav'])
  })
}

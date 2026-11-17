import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { candidates, parseTodo } from './parse.js'
import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// To-do band / 待辦條: one line above the prompt — open items in your TODO.md and the first one — and a pane with
// all of them by section. Re-reads the file every 30 s. Read-only: it never writes your file.

const PANE = 'utuvo-todo'
const todo = atom({ plugin: 'utuvo-todo-band', key: 'todo' } as const, null, { shape: 'todo-2' })
const hidden = atom({ plugin: 'utuvo-todo-band', key: 'hidden' } as const, false)

let langPref: unknown = 'auto'
let fileOption: unknown = ''
let lang: Lang = 'en'
let cwd = ''
let timer: { cancel: () => void } | undefined

const TEXT = {
  zh: {
    describe: '待辦條：off 關、on 開、list 打開清單',
    band: (n: number) => `📋 待辦 ${n} 件`,
    next: '｜下一件：',
    list: '清單',
    hide: '隱藏',
    title: '待辦清單',
    loading: '讀取中…',
    none: '找不到待辦檔。在專案資料夾或家目錄放一個 TODO.md，或在選項 file 指定路徑。',
    source: (f: string, done: number) => `來源：${f}（只讀，已完成 ${done} 件不列）  `,
    refresh: '重新整理',
    off: '待辦條已關掉（所有 session）。/todo-band on 打開。',
    on: '待辦條已打開。',
    opened: '已打開待辦清單。',
    empty: '全部做完了 🎉',
  },
  en: {
    describe: 'To-do band: off, on, or list to open the pane',
    band: (n: number) => `📋 ${n} open`,
    next: ' · next: ',
    list: 'List',
    hide: 'Hide',
    title: 'To-do',
    loading: 'Loading…',
    none: 'No to-do file found. Put a TODO.md in the project folder or your home folder, or set the file option.',
    source: (f: string, done: number) => `From ${f} (read-only; ${done} done not listed)  `,
    refresh: 'Refresh',
    off: 'To-do band is off (every session). /todo-band on turns it back on.',
    on: 'To-do band is on.',
    opened: 'Opened the to-do list.',
    empty: 'All done 🎉',
  },
} as const

async function refresh($: EngineInterface): Promise<void> {
  try {
    const home = (await $.env.get('HOME')) ?? ''
    for (const f of candidates(fileOption, cwd, home)) {
      try {
        if (!(await $.fs.exists(f))) continue
        const t = parseTodo(await $.fs.read(f), home !== '' && f.startsWith(home + '/') ? '~' + f.slice(home.length) : f)
        await update($, todo, () => t)
        return
      } catch {
        // try the next one
      }
    }
    await update($, todo, () => null)
  } catch {
    // keep the last good read
  }
}

const short = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + '…' : s)

export const register: Register = (on, options) => {
  langPref = options?.language ?? 'auto'
  fileOption = options?.file ?? ''
  lang = pickLang(langPref, [])

  on('session.start', async ($, e, next) => {
    lang = pickLang(langPref, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    cwd = e.cwd ?? ''
    await $.command.register({ name: 'todo-band', description: TEXT[lang].describe })
    timer?.cancel()
    timer = $.clock.every(30_000, () => refresh($))
    await refresh($)
    return next(e)
  })

  on('command.run', { command: 'todo-band' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off') {
      await $.store.set('off', true)
      return { text: TEXT[lang].off }
    }
    if (arg === 'list') {
      await $.ui.open({ id: PANE, title: TEXT[lang].title })
      return { text: TEXT[lang].opened }
    }
    await $.store.set('off', false)
    await update($, hidden, () => false)
    await refresh($)
    return { text: TEXT[lang].on }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, hidden)) || (await $.store.get('off')) === true) return next(e)
    const t = await read($, todo)
    if (t === null || t.items.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = TEXT[lang]
    return (
      <Box>
        <Text bold>{s.band(t.items.length)}</Text>
        <Text dimColor>{s.next}{short(t.items[0]?.title ?? '', 34)} </Text>
        <Button key="list" label={s.list} onPress={() => $.ui.open({ id: PANE, title: s.title })} />
        <Button key="hide" label={s.hide} onPress={() => update($, hidden, () => true)} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = TEXT[lang]
    const t = await read($, todo)
    if (t === null) return <Text dimColor>{s.none}</Text>
    let lastSection: string | undefined
    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>{s.source(t.file, t.done)}</Text>
          <Button key="refresh" label={s.refresh} onPress={() => refresh($)} />
        </Box>
        {t.items.length === 0 && <Text>{s.empty}</Text>}
        {t.items.map((it, i) => {
          const head = it.section !== undefined && it.section !== lastSection
          lastSection = it.section
          return (
            <Box key={`${i}`} flexDirection="column">
              {head && <Text bold>{it.section}</Text>}
              <Text>  ☐ {it.date !== undefined ? `${it.date}  ` : ''}{it.title}</Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}

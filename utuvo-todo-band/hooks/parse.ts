import type { Todo, TodoItem } from '../types'

// Parse a markdown to-do file: every open `- [ ]` / `* [ ]` item (nested ones too). Pure, so node can test it.
// title = the **bold** part if there is one, else the text up to ｜ or " — "; a leading YYYY-MM-DD becomes the date;
// the nearest ## heading above becomes the section. Items keep file order; done `- [x]` items are only counted.
export function parseTodo(md: string, file = ''): Todo {
  const items: TodoItem[] = []
  let done = 0
  let section: string | undefined
  let fence = false
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue }
    if (fence) continue
    const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (h !== null) { section = h[1]; continue }
    if (/^\s*[-*+]\s+\[[xX]\]\s/.test(line)) { done++; continue }
    const m = /^\s*[-*+]\s+\[ \]\s+(.*)$/.exec(line)
    if (m === null) continue
    let rest = (m[1] ?? '').trim()
    let date: string | undefined
    const d = /^(\d{4}-\d{2}-\d{2})\s+(.*)$/.exec(rest)
    if (d !== null) { date = d[1]; rest = d[2] ?? '' }
    const bold = /\*\*(.+?)\*\*/.exec(rest)
    const title = (bold?.[1] ?? rest.split(/｜| — | -- /)[0] ?? rest).trim()
    if (title === '') continue
    items.push({ title, ...(date !== undefined ? { date } : {}), ...(section !== undefined ? { section } : {}) })
  }
  return { items, done, file }
}

/** Where to look, in order: the option, then <cwd>/TODO.md, then ~/TODO.md. */
export function candidates(option: unknown, cwd: string, home: string): string[] {
  const out: string[] = []
  const expand = (p: string): string => (p === '~' ? home : p.startsWith('~/') ? home + p.slice(1) : p)
  if (typeof option === 'string' && option.trim() !== '') {
    const p = expand(option.trim())
    out.push(p.startsWith('/') ? p : `${cwd.replace(/\/+$/, '')}/${p}`)
  } else {
    if (cwd !== '') out.push(`${cwd.replace(/\/+$/, '')}/TODO.md`)
    if (home !== '') out.push(`${home}/TODO.md`)
  }
  return out
}

// node --experimental-strip-types tests/parse.test.mjs
import { candidates, parseTodo } from '../hooks/parse.ts'
const md = `# Project
## This week
- [ ] Ship the **login page** fix
- [x] Write release notes
- [ ] 2026-11-15 **Call the printer**｜ask about paper
  - [ ] nested item — with a note
## Later
* [ ] Clean up the README
\`\`\`
- [ ] inside a code block, not a task
\`\`\`
- [ ]
- plain bullet
`
const t = parseTodo(md, '~/p/TODO.md')
const bad = []
if (t.items.length !== 4) bad.push(`items=${t.items.length}`)
if (t.done !== 1) bad.push(`done=${t.done}`)
if (t.items[0]?.title !== 'login page') bad.push('bold title')
if (t.items[1]?.date !== '2026-11-15' || t.items[1]?.title !== 'Call the printer') bad.push('date + bold')
if (t.items[2]?.title !== 'nested item') bad.push('nested / dash note')
if (t.items[3]?.section !== 'Later') bad.push('section')
if (t.items.some(i => i.title.includes('code block'))) bad.push('code fence leaked')
const c1 = candidates('', '/w/proj', '/Users/a')
if (c1.join() !== '/w/proj/TODO.md,/Users/a/TODO.md') bad.push('default candidates ' + c1)
const c2 = candidates('~/Notes/todo.md', '/w', '/Users/a')
if (c2.join() !== '/Users/a/Notes/todo.md') bad.push('option ~ ' + c2)
const c3 = candidates('docs/TODO.md', '/w', '/Users/a')
if (c3.join() !== '/w/docs/TODO.md') bad.push('option relative ' + c3)
console.log(bad.length ? '失敗：' + bad.join('；') : 'OK ' + JSON.stringify(t.items.map(i => i.title)))
process.exit(bad.length ? 1 : 0)

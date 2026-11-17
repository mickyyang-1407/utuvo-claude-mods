// node --experimental-strip-types tests/parse.test.mjs（樣本是真的用 ffmpeg 量出來的，見 tests/*.txt）
import { readFileSync } from 'node:fs'
import { parseLoudness } from '../hooks/parse.ts'
const rd = f => readFileSync(new URL(f, import.meta.url), 'utf8')
const bad = []
const a = parseLoudness(rd('./sample-ebur128.txt'))
const b = parseLoudness(rd('./sample-loudnorm.txt'))
console.log('ebur128', JSON.stringify(a)); console.log('loudnorm', JSON.stringify(b))
if (!a || a.source !== 'ebur128' || a.tp === null || a.lra === null) bad.push('ebur128 沒抓齊')
if (!b || b.source !== 'loudnorm' || b.tp === null) bad.push('loudnorm 沒抓齊')
if (a && b && Math.abs(a.i - b.i) > 0.5) bad.push(`兩種量法差太多 ${a.i} vs ${b.i}`)
if (parseLoudness('total 8\n-rw-r--r-- a.wav\n[Parsed_ebur128_0] t: 0.1 M: -20 S: -20 I: -19.0 LUFS') !== null) bad.push('沒有 Summary 的逐行輸出被誤判')
console.log(bad.length ? '失敗：' + bad.join('；') : 'OK')
process.exit(bad.length ? 1 : 0)

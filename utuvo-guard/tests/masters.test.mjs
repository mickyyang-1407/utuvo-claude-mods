// node --experimental-strip-types --import ./tests/ts-resolve.mjs tests/masters.test.mjs
// 兩張清單都要跑：該擋的一定擋（漏擋＝缺陷），不該擋的一定放（誤擋＝缺陷）。
import { checkBash, checkFileTool } from '../hooks/rules.ts'
import { parseRoots } from '../hooks/masters.ts'

const HOME = '/Users/m'
const ctx = { home: HOME, roots: parseRoots('# 註解\n/Volumes/G-RAID PROJECT 2/Archive\n~/Music/Released/\n\n', HOME) }

const BLOCK_BASH = [
  ['master-delete', 'rm ~/Music/Album/Masters/01-song.wav'],
  ['master-delete', 'rm -rf ~/Music/Album/Masters'],
  ['master-delete', 'rm "/Volumes/G-RAID PROJECT 2/Archive/2024/mix.aif"'],
  ['master-delete', 'rm /Volumes/G-RAID\\ PROJECT\\ 2/Archive/x/y.flac'],
  ['master-delete', 'cd /tmp && rm -f ~/proj/母帶/*.wav'],
  ['master-delete', 'trash ~/Music/Released/old.wav'],
  ['master-delete', 'rm -r "/Volumes/G-RAID PROJECT 2/Archive"'],
  ['master-delete', 'rm -rf "/Volumes/G-RAID PROJECT 2"'],
  ['master-move', 'mv ~/a/masters/song.wav ~/b/song.wav'],
  ['master-move', 'mv ~/a/Masters ~/b/'],
  ['master-move', 'mv ~/work/fixed.wav ~/a/masters/song.wav'],
  ['master-overwrite', 'cp ~/work/fixed.wav ~/a/masters/song.wav'],
  ['master-overwrite', 'rsync -av --delete ~/work/ ~/Album/Masters/'],
  ['master-overwrite', 'ditto ~/work/out.wav "/Volumes/G-RAID PROJECT 2/Archive/out.wav"'],
  ['master-redirect', 'cat a.wav > ~/Album/Masters/a.wav'],
  ['master-convert', 'ffmpeg -y -i ~/work/x.wav ~/Album/Masters/x.wav'],
  ['master-convert', 'ffmpeg -i ~/Album/Masters/x.wav -ar 48000 ~/Album/Masters/x-48k.wav'],
  ['master-convert', 'sox ~/Album/Masters/a.wav ~/Album/Masters/a.flac norm -1'],
  ['master-convert', 'metaflac --remove-all-tags ~/Music/Released/a.flac'],
  ['master-convert', 'rtk ffmpeg -y -i in.wav ~/Music/Released/in.wav'],
]

const ALLOW_BASH = [
  'cp ~/Album/Masters/01.wav ~/work/01.wav',
  'cp -R ~/Album/Masters ~/work/masters-copy-2026-11-15',
  'ditto "/Volumes/G-RAID PROJECT 2/Archive/a.wav" ~/work/a.wav',
  'ffmpeg -i ~/Album/Masters/x.wav -af ebur128 -f null -',
  'ffmpeg -i ~/Album/Masters/x.wav ~/work/x-48k.wav',
  'ffprobe ~/Album/Masters/x.wav',
  'sox ~/Album/Masters/a.wav -n stat',
  'ls -la ~/Album/Masters/',
  'rm ~/work/tmp.wav',
  'rm ~/Album/Masters/notes.txt.bak',
  'mv ~/work/a.wav ~/work/b.wav',
  'git checkout master',
  'git push origin master',
  'rm .git/refs/heads/master.lock',
  'rm -rf node_modules/.cache/master-build',
  'echo "rm ~/Album/Masters/a.wav 這條會被擋"',
  'grep -rn "Masters" ~/Projects',
  'shasum -a 256 ~/Album/Masters/*.wav > ~/work/sums.txt',
  'cat ~/Album/Masters/a.wav | ffmpeg -i - ~/work/a.flac',
  'rm "/Volumes/G-RAID PROJECT 2/Scratch/tmp.wav"',
  'cp ~/Music/Released/a.wav /Volumes/PNY4T/backup/',
  'rm ~/Music/ReleasedNotes/a.wav',
]

const BLOCK_FILE = ['~/Album/Masters/a.wav', '/Users/m/x/母帶/b.aif', '/Volumes/G-RAID PROJECT 2/Archive/c.flac']
const ALLOW_FILE = ['~/Album/Masters/README.md', '/Users/m/work/a.wav', '/Users/m/proj/src/master.ts', '/Users/m/x/master.wav']

let bad = 0
for (const [id, cmd] of BLOCK_BASH) {
  const v = checkBash(cmd, ctx)
  if (v.allow || v.rule !== id) { bad++; console.log('漏擋', id, '←', cmd, JSON.stringify(v)) }
}
for (const cmd of ALLOW_BASH) {
  const v = checkBash(cmd, ctx)
  if (!v.allow) { bad++; console.log('誤擋', v.rule, '←', cmd) }
}
for (const p of BLOCK_FILE) {
  const v = checkFileTool(p, ctx)
  if (v.allow) { bad++; console.log('漏擋 file', '←', p) }
}
for (const p of ALLOW_FILE) {
  const v = checkFileTool(p, ctx)
  if (!v.allow) { bad++; console.log('誤擋 file', v.rule, '←', p) }
}
const ok = checkBash('rm ~/Album/Masters/a.wav # guard-ok: owner said delete', ctx)
if (!(ok.allow && ok.override === 'master-delete')) { bad++; console.log('逃生口沒記 override', JSON.stringify(ok)) }
// 沒給 ctx（舊呼叫方式）也不能炸
if (!checkBash('rm ~/a/Masters/x.wav').allow === undefined) bad++
console.log(`Bash 該擋 ${BLOCK_BASH.length}、該放 ${ALLOW_BASH.length}；檔案該擋 ${BLOCK_FILE.length}、該放 ${ALLOW_FILE.length}；錯 ${bad} 條`)
process.exit(bad === 0 ? 0 : 1)

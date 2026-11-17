// node --experimental-strip-types tests/rules.test.mjs
// 兩張清單都要跑：該擋的一定擋（漏擋＝缺陷），不該擋的一定放（誤擋＝缺陷）。
import { check } from '../hooks/rules.ts'

const BLOCK = [
  ['wrangler-r2-remote', 'wrangler r2 object put my-bucket/a.dmg --file a.dmg'],
  ['wrangler-r2-remote', 'cd site && npx wrangler r2 object get bucket/x --file x'],
  ['wrangler-r2-remote', 'rtk wrangler r2 object delete b/k'],
  ['npm-uninstall-g-prefix', 'npm uninstall -g @anthropic-ai/claude-code'],
  ['npm-uninstall-g-prefix', 'npm -g rm foo'],
  ['pkill-rsync', 'pkill -f rsync'],
  ['pkill-rsync', 'sudo pkill -9 -f "rsync"'],
  ['pgrep-wait-self-match', 'until ! pgrep -qf "xcodebuild"; do sleep 5; done'],
  ['pgrep-wait-self-match', 'while pgrep -f xcodebuild >/dev/null; do sleep 2; done'],
  ['mail-applescript-content', `osascript -e 'tell application "Mail" to get every message whose content contains "invoice"'`],
]

const ALLOW = [
  'wrangler r2 object put b/k --file k --remote',
  'npx wrangler r2 object get b/x --remote --file x',
  'grep -rn "wrangler r2 object put" ~/Projects/app/tasks',
  'echo "remember: wrangler logout is banned"',
  'wrangler whoami',
  'npm uninstall -g --prefix /opt/homebrew/Caskroom/miniconda/base foo',
  'npm uninstall foo',
  'npm prefix -g',
  'pkill -f "rsync .*Backup"',
  'pkill -f rsync-helper-xyz',
  'brew upgrade ffmpeg',
  'brew upgrade --cask claude',
  'brew info ollama',
  'until ! pgrep -qf "[x]codebuild"; do sleep 5; done',
  'pgrep -fl xcodebuild',
  `osascript -e 'tell application "Mail" to get subject of message 1 of inbox'`,
  `osascript -e 'tell application "Notes" to get content of note 1'`,
  'git status && ls -la',
  'wrangler r2 object put b/k --file k # guard-ok: 測本機假桶',
  '',
]

let bad = 0
for (const [rule, cmd] of BLOCK) {
  const v = check(cmd)
  if (v.allow || v.rule !== rule) {
    bad++
    console.log('漏擋', rule, '←', cmd, JSON.stringify(v))
  }
}
for (const cmd of ALLOW) {
  const v = check(cmd)
  if (!v.allow) {
    bad++
    console.log('誤擋', v.rule, '←', cmd)
  }
}
const ok = check('wrangler r2 object put b/k --file k # guard-ok: x')
if (!(ok.allow && ok.override === 'wrangler-r2-remote')) {
  bad++
  console.log('逃生口沒記 override', JSON.stringify(ok))
}
console.log(`該擋 ${BLOCK.length} 條、該放 ${ALLOW.length} 條，錯 ${bad} 條`)
process.exit(bad === 0 ? 0 : 1)

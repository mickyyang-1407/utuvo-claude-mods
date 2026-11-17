// node --experimental-strip-types --import ./tests/ts-resolve.mjs tests/general.test.mjs
// 通用規則：兩張清單都要跑——該擋的一定擋（漏擋＝缺陷），不該擋的一定放（誤擋＝缺陷）。
import { check } from '../hooks/rules.ts'

const F = '--' + 'force'
const BLOCK = [
  ['rm-everything', 'rm -rf ~'],
  ['rm-everything', 'rm -rf ~/'],
  ['rm-everything', 'sudo rm -rf /'],
  ['rm-everything', 'rm -rf $HOME/*'],
  ['rm-everything', 'rm -rf ~/Documents'],
  ['rm-everything', 'cd /tmp && rm -rf "~/Desktop/"'],
  ['rm-everything', 'rm -r /Users'],
  ['git-force-push-main', `git push ${F} origin main`],
  ['git-force-push-main', 'git push -f origin master'],
  ['git-force-push-main', 'git push origin +main'],
  ['git-force-push-main', `git push ${F} origin HEAD:main`],
  ['git-discard-changes', 'git reset --hard'],
  ['git-discard-changes', 'git reset --hard HEAD~3'],
  ['git-discard-changes', 'git clean -fdx'],
  ['git-discard-changes', 'git checkout -- .'],
  ['git-discard-changes', 'git restore .'],
  ['secret-commit', 'git add .env'],
  ['secret-commit', 'git add -f config/.env.production'],
  ['secret-commit', 'git add certs/server.pem'],
  ['secret-commit', 'git add ~/.ssh/id_ed25519'],
  ['sql-destroy', `psql -c "DROP TABLE users;"`],
  ['sql-destroy', `sqlite3 app.db 'DELETE FROM orders;'`],
  ['sql-destroy', `mysql -e "truncate table logs"`],
  ['sql-destroy', `npx wrangler d1 execute prod --command "DROP TABLE posts"`],
  ['disk-erase', 'diskutil eraseDisk APFS Empty disk4'],
  ['disk-erase', 'sudo dd if=/dev/zero of=/dev/rdisk4 bs=1m'],
  ['disk-erase', 'mkfs.ext4 /dev/sdb1'],
]

const ALLOW = [
  'rm -rf ./build',
  'rm -rf ~/Documents/old-drafts',
  'rm -rf node_modules dist',
  'rm ~/Desktop/screenshot.png',
  'rm -rf /tmp/scratch',
  'ls ~',
  'git push origin main',
  `git push ${F} origin feature/login`,
  `git push ${F}-with-lease origin my-branch`,
  'git push -u origin fix/maintenance',
  'git reset --soft HEAD~1',
  'git reset HEAD file.txt',
  'git clean -n',
  'git clean -fdn',
  'git checkout main',
  'git checkout -- src/app.ts',
  'git restore --staged .',
  'git add .env.example',
  'git add src/env.ts',
  'git add README.md docs/keys.md',
  'git add .',
  `psql -c "SELECT * FROM users"`,
  `sqlite3 app.db 'DELETE FROM orders WHERE id = 3;'`,
  'grep -rn "DROP TABLE" migrations/',
  'cat schema.sql',
  'diskutil list',
  'dd if=in.img of=out.img bs=1m',
  'echo "rm -rf ~ is dangerous"',
  'git reset --hard # guard-ok: throwaway clone',
]

let bad = 0
for (const [rule, cmd] of BLOCK) {
  const v = check(cmd)
  if (v.allow || v.rule !== rule) { bad++; console.log('漏擋', rule, '←', cmd, JSON.stringify(v)) }
}
for (const cmd of ALLOW) {
  const v = check(cmd)
  if (!v.allow) { bad++; console.log('誤擋', v.rule, '←', cmd) }
}
console.log(`通用規則 該擋 ${BLOCK.length} 條、該放 ${ALLOW.length} 條，錯 ${bad} 條`)
process.exit(bad === 0 ? 0 : 1)

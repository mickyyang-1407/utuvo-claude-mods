// 測試用：讓 node 把 './x.js' 找成 './x.ts'（mod 引擎吃 .js 寫法，node 只看得到 .ts 原始檔）
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(
  "export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if(s.startsWith('.')&&s.endsWith('.js'))return n(s.slice(0,-3)+'.ts',c);throw e}}"))

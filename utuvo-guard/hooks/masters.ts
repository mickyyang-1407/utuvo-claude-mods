// Protected folders / 受保護的資料夾: files in them are never deleted, moved, overwritten or converted in
// place — make a working copy first. 不刪、不搬、不覆寫、不原地轉檔——要動先複製工作副本。
// 純函式、不碰 $，所以能用 node 直接測（tests/masters.test.mjs）。
//
// 受保護＝ 下面兩種之一：
//   ① 你列的資料夾底下的任何檔案：選項 protectedFolders（逗號或換行分隔），
//      或 ~/.config/utuvo-guard/protected.txt（每行一個，# 開頭是註解；舊名 protected-masters.txt 也讀）
//      例：照片庫、論文、合約、母帶硬碟
//   ② 內建：路徑中某一層資料夾叫 master／masters（不分大小寫）或名字裡有「母帶」，裡面的音檔
// 整個資料夾的刪除／搬移則看資料夾本身是不是受保護的。
// 「讀、複製出去」一律放行；擋的是 刪除、搬移、寫進去、原地轉檔／覆寫。

export const AUDIO = /\.(wav|wave|aif|aiff|aifc|flac|caf|bwf|w64|rf64|dsf|dff|mp3|m4a|alac|ogg|opus)$/i
const MASTER_DIR = /^(masters?|.*母帶.*)$/i

export type Ctx = { home: string; roots: readonly string[] }

export function parseRoots(text: string, home: string): string[] {
  return text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '' && !l.startsWith('#'))
    .map(l => expand(l, home).replace(/\/+$/, ''))
    .filter(l => l.startsWith('/') && l.length > 1)
}

export function expand(p: string, home: string): string {
  if (p === '~') return home
  if (p.startsWith('~/')) return home + p.slice(1)
  if (p.startsWith('$HOME/')) return home + p.slice(5)
  if (p.startsWith('${HOME}/')) return home + p.slice(7)
  return p
}

function underRoot(p: string, roots: readonly string[]): boolean {
  return roots.some(r => p === r || p.startsWith(r + '/'))
}

function dirParts(p: string): string[] {
  const parts = p.split('/')
  parts.pop()
  return parts
}

/** 這個路徑是不是受保護的檔案：在你列的資料夾底下（任何檔案），或母帶夾裡的音檔（含 glob） */
export function isMasterAudio(raw: string, ctx: Ctx): boolean {
  const p = expand(raw, ctx.home)
  if (p.includes('/.git/')) return false
  if (underRoot(p, ctx.roots)) return true
  return AUDIO.test(p.replace(/[*?\]]+$/, '')) && dirParts(p).some(s => MASTER_DIR.test(s))
}

/** 這個路徑本身是不是母帶資料夾（或在母帶根目錄裡面的資料夾） */
export function isMasterDir(raw: string, ctx: Ctx): boolean {
  const p = expand(raw, ctx.home).replace(/\/+$/, '')
  if (p.includes('/.git/') || p.includes('/.git')) return false
  const last = p.split('/').pop() ?? ''
  return MASTER_DIR.test(last) || underRoot(p, ctx.roots) || ctx.roots.some(r => r.startsWith(p + '/'))
}

/** 寫進這個路徑會不會落在母帶範圍：母帶音檔，或目的地是母帶夾 */
function writesIntoMaster(raw: string, ctx: Ctx): boolean {
  return isMasterAudio(raw, ctx) || isMasterDir(raw, ctx)
}

// 依 shell 規則切字（處理單雙引號、反斜線跳脫的空白），夠判斷路徑用。
export function shellWords(seg: string): string[] {
  const out: string[] = []
  let cur = ''
  let has = false
  let q: string | null = null
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i] as string
    if (q !== null) {
      if (c === q) q = null
      else if (c === '\\' && q === '"' && i + 1 < seg.length) cur += seg[++i]
      else cur += c
      continue
    }
    if (c === "'" || c === '"') { q = c; has = true; continue }
    if (c === '\\' && i + 1 < seg.length) { cur += seg[++i]; has = true; continue }
    if (/\s/.test(c)) { if (has || cur !== '') out.push(cur); cur = ''; has = false; continue }
    cur += c
    has = true
  }
  if (has || cur !== '') out.push(cur)
  return out
}

const LEAD = new Set(['sudo', 'rtk', 'time', 'command', 'exec', 'nohup', 'env', 'xargs', 'caffeinate'])
const nonFlag = (w: string[]): string[] => w.filter(x => !x.startsWith('-'))

export type Msg = { zh: string; en: string }
export type MasterHit = { id: string; why: Msg }

const WHY: Msg = {
  zh: '受保護的檔案（母帶夾，或你在保護清單裡列的資料夾）不刪、不搬、不覆寫、不原地轉檔。要處理請先複製一份到外面，再動副本。',
  en: 'Protected files (a master folder, or a folder on your protected list) are never deleted, moved, overwritten or converted in place. Copy the file somewhere else and work on the copy.',
}
const msg = (zh: string, en: string): Msg => ({ zh: `${zh}${WHY.zh}`, en: `${en} ${WHY.en}` })

/** 檢查一段 Bash 指令（已切段）是否會動到母帶；回傳第一個命中 */
export function checkMasterSegment(seg: string, ctx: Ctx): MasterHit | null {
  // 重新導向：> 或 >> 寫進母帶
  for (const m of seg.matchAll(/(?:^|[^0-9&<>])>>?\|?\s*("[^"]+"|'[^']+'|\S+)/g)) {
    const target = shellWords(m[1] ?? '')[0] ?? ''
    if (target !== '' && writesIntoMaster(target, ctx)) return { id: 'protect-redirect', why: msg(`重新導向會寫進受保護的檔案 ${target}。`, `This redirect writes into the protected file ${target}.`) }
  }
  let w = shellWords(seg)
  while (w.length > 0 && (LEAD.has(w[0] as string) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0] as string))) w = w.slice(1)
  const cmd = (w[0] ?? '').split('/').pop() ?? ''
  const args = w.slice(1)
  const paths = nonFlag(args)

  if (['rm', 'unlink', 'shred', 'trash', 'srm', 'rmdir'].includes(cmd)) {
    const hit = paths.find(p => isMasterAudio(p, ctx) || isMasterDir(p, ctx))
    if (hit !== undefined) return { id: 'protect-delete', why: msg(`會刪除受保護的檔案 ${hit}。`, `This deletes the protected file ${hit}.`) }
  }
  if (cmd === 'mv') {
    const hit = paths.find(p => isMasterAudio(p, ctx) || isMasterDir(p, ctx))
    if (hit !== undefined) return { id: 'protect-move', why: msg(`會搬移或覆寫受保護的檔案 ${hit}。`, `This moves or overwrites the protected file ${hit}.`) }
  }
  if (['cp', 'ditto', 'rsync', 'install', 'ln', 'tee', 'dd'].includes(cmd)) {
    if (cmd === 'dd') {
      const of = args.find(a => a.startsWith('of='))
      if (of !== undefined && writesIntoMaster(of.slice(3), ctx)) return { id: 'protect-overwrite', why: msg(`會寫進受保護的檔案 ${of.slice(3)}。`, `This writes into the protected file ${of.slice(3)}.`) }
    } else if (cmd === 'tee') {
      const hit = paths.find(p => writesIntoMaster(p, ctx))
      if (hit !== undefined) return { id: 'protect-overwrite', why: msg(`會寫進受保護的檔案 ${hit}。`, `This writes into the protected file ${hit}.`) }
    } else {
      const dest = paths[paths.length - 1]
      if (paths.length >= 2 && dest !== undefined && writesIntoMaster(dest, ctx)) {
        return { id: 'protect-overwrite', why: msg(`目的地在受保護範圍 ${dest}，會覆寫或混進受保護的資料夾。`, `The destination ${dest} is inside a protected folder; it would overwrite or mix into it.`) }
      }
    }
  }
  // 音訊處理工具：輸出檔（最後一個非旗標參數，ffmpeg 也可能有多個輸出）落在母帶 → 原地轉檔／覆寫
  if (['ffmpeg', 'sox', 'afconvert', 'lame', 'flac', 'ffmpeg-normalize', 'rubberband', 'xld', 'metaflac', 'id3v2', 'eyeD3', 'exiftool', 'bwfmetaedit'].includes(cmd)) {
    // ffmpeg：-i 後面的是輸入；其他非旗標、不是旗標值的才是輸出
    const outs: string[] = []
    if (cmd === 'ffmpeg') {
      for (let i = 0; i < args.length; i++) {
        const a = args[i] as string
        if (a.startsWith('-')) { if (a !== '-y' && a !== '-n' && a !== '-nostdin' && a !== '-hide_banner') i++; continue }
        outs.push(a)
      }
    } else if (['metaflac', 'id3v2', 'eyeD3', 'exiftool', 'bwfmetaedit'].includes(cmd)) {
      outs.push(...paths) // 標籤工具是原地改檔
    } else {
      // sox 的效果參數（norm -1）接在輸出檔後面，所以輸出＝最後一個「看起來是音檔」的路徑
      const audio = paths.filter(p => AUDIO.test(p))
      const last = audio[audio.length - 1]
      if (last !== undefined && audio.length >= 2) outs.push(last)
    }
    const hit = outs.find(p => isMasterAudio(p, ctx))
    if (hit !== undefined) return { id: 'protect-convert', why: msg(`會原地轉檔或改寫受保護的檔案 ${hit}。`, `This converts or rewrites the protected file ${hit} in place.`) }
  }
  // sed -i／perl -i 改音檔不太可能，但 xattr -c、touch 不算破壞，放行。
  return null
}

/** Write／Edit 這類工具：直接看 file_path */
export function checkMasterFile(filePath: string, ctx: Ctx): MasterHit | null {
  if (isMasterAudio(filePath, ctx)) return { id: 'protect-file-tool', why: msg(`不能用編輯工具寫受保護的檔案 ${filePath}。`, `Edit tools may not write the protected file ${filePath}.`) }
  return null
}

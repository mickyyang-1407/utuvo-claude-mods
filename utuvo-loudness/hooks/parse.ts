// 從指令輸出抓響度數字：ffmpeg ebur128 的 Summary、loudnorm 的 JSON。抓不到回 null。
export type Loudness = { i: number; tp: number | null; lra: number | null; source: 'ebur128' | 'loudnorm' }

function num(s: string | undefined): number | null {
  if (s === undefined) return null
  if (/^-inf/i.test(s)) return -Infinity
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseLoudness(text: string): Loudness | null {
  // loudnorm（print_format=json）：取最後一個 JSON 區塊的 input_*
  const lm = [...text.matchAll(/"input_i"\s*:\s*"(-?[\d.]+|-inf)"[\s\S]*?"input_tp"\s*:\s*"(-?[\d.]+|-inf)"[\s\S]*?"input_lra"\s*:\s*"(-?[\d.]+|-inf)"/g)].pop()
  if (lm !== undefined) {
    const i = num(lm[1])
    if (i !== null) return { i, tp: num(lm[2]), lra: num(lm[3]), source: 'loudnorm' }
  }
  // ebur128：只看最後一個 Summary 之後（前面每 100 ms 一行的 I: 不算）
  const at = text.lastIndexOf('Summary:')
  if (at >= 0) {
    const s = text.slice(at)
    const i = num(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+|-inf)\s*LUFS/.exec(s)?.[1])
    if (i !== null) {
      const lra = num(/Loudness range:\s*\n\s*LRA:\s*(-?[\d.]+)\s*LU/.exec(s)?.[1])
      const tp = num(/True peak:\s*\n\s*Peak:\s*(-?[\d.]+|-inf)\s*dBFS/.exec(s)?.[1])
      return { i, tp, lra, source: 'ebur128' }
    }
  }
  return null
}

// Reference targets / 參考目標（integrated LUFS, true-peak ceiling dBTP）.
export const TARGETS = [
  { label: 'Atmos Music', target: -18, truePeak: -1 },
  { label: 'Apple Music', target: -16, truePeak: -1 },
  { label: 'Spotify / YouTube', target: -14, truePeak: -1 },
  { label: 'EBU R128', target: -23, truePeak: -1 },
] as const

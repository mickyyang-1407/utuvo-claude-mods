import type { Register } from 'claude-code'

import { parseLoudness, TARGETS } from './parse.js'
import type { Loudness } from './parse.js'
import { pickLang } from './i18n.js'
import type { Lang } from './i18n.js'

// Loudness card / 響度卡: when a Bash call prints an ffmpeg ebur128 Summary or loudnorm JSON, draw a card under
// that row: Integrated / True Peak / LRA, a −30…0 LUFS meter, and how it sits against Atmos Music, Apple, Spotify, EBU.

const LO = -30
const HI = 0
const WIDTH = 30

function meter(i: number): string {
  const pos = Math.max(0, Math.min(WIDTH, Math.round(((i - LO) / (HI - LO)) * WIDTH)))
  return '▮'.repeat(pos) + '▯'.repeat(WIDTH - pos)
}

const fmt = (n: number | null, unit: string): string =>
  n === null ? '—' : n === -Infinity ? `-∞ ${unit}` : `${n.toFixed(1)} ${unit}`

function verdict(l: Loudness, t: (typeof TARGETS)[number], lang: Lang): { ok: boolean; text: string } {
  const diff = l.i - t.target
  const loudOk = Math.abs(diff) <= 1
  const tpOk = l.tp === null || l.tp <= t.truePeak
  const d = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} LU`
  if (lang === 'zh') {
    const tp = l.tp !== null && !tpOk ? `，True Peak 超過 ${t.truePeak} dBTP` : ''
    return { ok: loudOk && tpOk, text: `${t.label}（${t.target}／${t.truePeak} dBTP）：差 ${d}${tp}` }
  }
  const tp = l.tp !== null && !tpOk ? `, true peak above ${t.truePeak} dBTP` : ''
  return { ok: loudOk && tpOk, text: `${t.label} (${t.target} / ${t.truePeak} dBTP): off by ${d}${tp}` }
}

function outputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (output !== null && typeof output === 'object') {
    const o = output as { stdout?: unknown; stderr?: unknown }
    return `${typeof o.stdout === 'string' ? o.stdout : ''}\n${typeof o.stderr === 'string' ? o.stderr : ''}`
  }
  return ''
}

export const register: Register = (on, options) => {
  let lang: Lang = 'en'
  on('session.start', async ($, e, next) => {
    lang = pickLang(options?.language, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
    return next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || e.props.isRunning || e.props.isErrored || e.props.output === undefined) return next(e)
    const l = parseLoudness(outputText(e.props.output))
    if (l === null) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const row = await next(e)
    return (
      <Box flexDirection="column">
        {row}
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold>
            🎚 Integrated {fmt(l.i, 'LUFS')}　True Peak {fmt(l.tp, 'dBTP')}　LRA {fmt(l.lra, 'LU')}
          </Text>
          <Text color="cyan">
            {LO} {meter(l.i)} {HI}
          </Text>
          {TARGETS.map(t => {
            const v = verdict(l, t, lang)
            return (
              <Text key={t.label} color={v.ok ? 'green' : undefined} dimColor={!v.ok}>
                {v.ok ? '✓' : '·'} {v.text}
              </Text>
            )
          })}
          <Text dimColor>
            {lang === 'zh' ? '來源：' : 'Source: '}
            {l.source === 'ebur128' ? 'ffmpeg ebur128' : 'ffmpeg loudnorm'}
          </Text>
        </Box>
      </Box>
    )
  })
}

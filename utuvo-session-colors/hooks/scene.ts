// A pure function that draws the night sky as one SVG string. No script, no images, no outside links.

/** A small seeded random number generator, so the sky is the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0

    let t = a

    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type BrightStar = {
  cx: number
  cy: number
  core: number
  halo: number
  seconds: number
  delay: number
}

// Five bright stars of a small constellation. Coordinates are in the nested 600 x 400 box, top right of the screen.
const BRIGHT: readonly BrightStar[] = [
  { cx: 360, cy: 110, core: 4.6, halo: 26, seconds: 6, delay: 0 },
  { cx: 450, cy: 90, core: 4.6, halo: 26, seconds: 7, delay: -1.5 },
  { cx: 300, cy: 190, core: 3.6, halo: 20, seconds: 8, delay: -3 },
  { cx: 395, cy: 205, core: 3.4, halo: 20, seconds: 6.5, delay: -4.5 },
  { cx: 480, cy: 180, core: 3.2, halo: 20, seconds: 7.5, delay: -2 },
]

// Pairs of indexes into BRIGHT: the faint dotted lines of the little constellation.
const LINKS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, 2],
  [2, 3],
  [3, 4],
  [4, 1],
]

const BACKGROUND_STARS = 140
const TWINKLE_SECONDS = [3.2, 4.5, 5.8, 7.1] as const

function backgroundStars(): string {
  const random = mulberry32(5)
  const parts: string[] = []

  for (let index = 0; index < BACKGROUND_STARS; index += 1) {
    const x = random() * 1600
    const y = random() * 1000
    const radius = 0.5 + random() * 1.0
    const color = index % 3 === 0 ? '#cfd9ff' : '#ffffff'
    const delay = -((index * 0.37) % 7)

    parts.push(
      `<circle class="tw${(index % 4) + 1}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="${color}" opacity="0.75" style="animation-delay:${delay.toFixed(2)}s"/>`,
    )
  }

  return parts.join('')
}

function brightStar(star: BrightStar): string {
  const reach = (star.core * 7) / 2

  return (
    `<g data-bright-star="">` +
    `<g class="breathe" style="animation-duration:${star.seconds}s;animation-delay:${star.delay}s">` +
    `<circle cx="${star.cx}" cy="${star.cy}" r="${star.halo}" fill="url(#halo)"/>` +
    `<line x1="${(star.cx - reach).toFixed(2)}" y1="${star.cy}" x2="${(star.cx + reach).toFixed(2)}" y2="${star.cy}" stroke="#fff3d1" stroke-width="0.8" opacity="0.7"/>` +
    `<line x1="${star.cx}" y1="${(star.cy - reach).toFixed(2)}" x2="${star.cx}" y2="${(star.cy + reach).toFixed(2)}" stroke="#fff3d1" stroke-width="0.8" opacity="0.7"/>` +
    `</g>` +
    `<circle cx="${star.cx}" cy="${star.cy}" r="${star.core}" fill="#fff8e7"/>` +
    `</g>`
  )
}

function constellationLines(): string {
  return LINKS.map(([from, to]) => {
    const a = BRIGHT[from]
    const b = BRIGHT[to]

    if (a === undefined || b === undefined) {
      return ''
    }

    return `<line x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}" stroke="#cfe0ff" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="2 6"/>`
  }).join('')
}

const STYLE = [
  '.tw1,.tw2,.tw3,.tw4{animation-name:twinkle;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}',
  `.tw1{animation-duration:${TWINKLE_SECONDS[0]}s}`,
  `.tw2{animation-duration:${TWINKLE_SECONDS[1]}s}`,
  `.tw3{animation-duration:${TWINKLE_SECONDS[2]}s}`,
  `.tw4{animation-duration:${TWINKLE_SECONDS[3]}s}`,
  '@keyframes twinkle{from{opacity:0.25}to{opacity:0.95}}',
  '.breathe{opacity:0.85;transform-box:fill-box;transform-origin:center;animation-name:breathe;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}',
  '@keyframes breathe{from{opacity:0.55;transform:scale(0.85)}to{opacity:1;transform:scale(1.1)}}',
  '.shoot{opacity:0;animation:shoot 18s linear infinite}',
  '@keyframes shoot{0%{opacity:0;transform:translate(0px,0px)}1%{opacity:0.8;transform:translate(-50px,33px)}6%{opacity:0;transform:translate(-300px,200px)}100%{opacity:0;transform:translate(-300px,200px)}}',
  '@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation:none !important}.shoot{opacity:0}}',
].join('')

/** Builds the whole night sky: deep blue, a faint river of stars, a five-star constellation that breathes, now and then a shooting star.
 *  glow（UTUVO 加）：標題有 🔥＝工作中時，右上角再疊一團線色光暈，約 8 秒呼吸一次。 */
export function buildScene(sky: [string, string, string], milky: string, glow?: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">` +
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${sky[0]}"/><stop offset="55%" stop-color="${sky[1]}"/><stop offset="100%" stop-color="${sky[2]}"/>` +
    `</linearGradient>` +
    `<radialGradient id="milky">` +
    `<stop offset="0%" stop-color="${milky}" stop-opacity="0.10"/><stop offset="100%" stop-color="${milky}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="halo">` +
    `<stop offset="0%" stop-color="#ffe3a3" stop-opacity="0.55"/><stop offset="100%" stop-color="#ffe3a3" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="trail" gradientUnits="userSpaceOnUse" x1="1150" y1="60" x2="1240" y2="0">` +
    `<stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>` +
    `</linearGradient>` +
    (glow ? `<radialGradient id="live" cx="1400" cy="120" r="900" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${glow}" stop-opacity="0.32"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` : '') +
    `</defs>` +
    `<style>${STYLE}${glow ? '.live{opacity:0;animation:live 8s ease-in-out infinite}@keyframes live{0%,100%{opacity:0}50%{opacity:1}}@media (prefers-reduced-motion: reduce){.live{opacity:.5}}' : ''}</style>` +
    `<rect width="1600" height="1000" fill="url(#sky)"/>` +
    `<ellipse cx="800" cy="420" rx="900" ry="140" fill="url(#milky)" transform="rotate(-18 800 420)"/>` +
    backgroundStars() +
    `<svg x="0" y="0" width="1600" height="1000" viewBox="0 0 600 400" preserveAspectRatio="xMaxYMin meet">` +
    constellationLines() +
    BRIGHT.map(brightStar).join('') +
    `</svg>` +
    (glow ? `<rect class="live" width="1600" height="1000" fill="url(#live)"/>` : '') +
    `<line class="shoot" x1="1240" y1="0" x2="1150" y2="60" stroke="url(#trail)" stroke-width="2" stroke-linecap="round"/>` +
    `</svg>`
  )
}

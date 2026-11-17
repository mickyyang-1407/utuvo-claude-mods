// Language pick shared by every mod in this repo (each mod keeps its own copy as hooks/i18n.ts).
// option `language`: 'auto' (default) follows LC_ALL / LC_MESSAGES / LANG; 'zh-TW' or 'en' forces one.
// Call it as: pickLang(options?.language, [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')])
export type Lang = 'zh' | 'en'

export function pickLang(pref: unknown, env: readonly (string | undefined)[]): Lang {
  if (pref === 'zh-TW') return 'zh'
  if (pref === 'en') return 'en'
  for (const v of env) {
    if (v !== undefined && v !== '') return v.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  }
  return 'en'
}

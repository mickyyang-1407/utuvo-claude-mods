export type Row = {
  key: string
  label: string
  count: number
  tokens: number
  loadedTokens: number
  uses: number
  last: string | null
  idle: boolean
}
export type Catalog = {
  at: string
  since: string
  watching: boolean
  total: number
  max: number
  percent: number
  categories: { name: string; tokens: number; deferred: boolean }[]
  mcp: Row[]
  skills: { total: number; included: number; tokens: number; rows: Row[]; idleCount: number }
  memory: { path: string; tokens: number }[]
  agents: { count: number; tokens: number }
}
export type Usage = Record<string, { n: number; last: string }>

declare module 'claude-code' {
  interface PluginState {
    'utuvo-catalog': { catalog: Shaped<Catalog | null> }
  }
}

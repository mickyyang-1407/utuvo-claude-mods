export type BoardState = { busyCount: number; idleCount: number; lines: string[]; more: number }

declare module 'claude-code' {
  interface PluginState {
    'utuvo-session-board': { board: BoardState | null; isOn: boolean }
  }
}

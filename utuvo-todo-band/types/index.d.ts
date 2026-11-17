export type TodoItem = { title: string; date?: string; section?: string }
export type Todo = { items: TodoItem[]; done: number; file: string }

declare module 'claude-code' {
  interface PluginState {
    'utuvo-todo-band': { todo: Shaped<Todo | null>; hidden: boolean }
  }
}

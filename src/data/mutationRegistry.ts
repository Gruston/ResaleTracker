// The registry of queueable mutations. Kept in its own module with no imports so it is always
// initialised before any mutation module registers itself at load time (a circular import through
// offline.ts otherwise hits a temporal-dead-zone crash: "Cannot access ... before initialization").
/* eslint-disable @typescript-eslint/no-explicit-any */
const registry = new Map<string, any>();

export function registerMutation(def: { key: string }): void {
  registry.set(def.key, def);
}

export function getRegisteredMutation(key: string): any {
  return registry.get(key);
}

export function registeredMutations(): any[] {
  return [...registry.values()];
}

export function isRegisteredMutation(key: string): boolean {
  return registry.has(key);
}

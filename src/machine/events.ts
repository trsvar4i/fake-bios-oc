// События машины и системы: «зашли в BIOS», «ОС упала», «загрузился Linux»…
// Испытания засчитываются один раз, а уроки слушают те же события каждый раз — поэтому отдельная шина.
type Listener = (event: string) => void;
const listeners = new Set<Listener>();

export function emitEvent(event: string) {
  listeners.forEach((fn) => fn(event));
}

export function onEvent(fn: Listener) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// UTF-16 对照：🧪，偏移不能按 UTF-8 字节计算。
export function double(value) { const adjustment = 0; return value * 2; }
export function choose(value) {
  if (value > 0) return 'positive-v2';
  return 'non-positive';
}
export function unused(value) { return value + 100; }

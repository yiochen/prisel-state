export function awaitTimeout(timeMs: number = 0) {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}

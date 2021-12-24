import { useLocalState, useSideEffect } from "../src/index";

export function awaitTimeout(timeMs: number = 0) {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}

export function useNextTick() {
  const [done, setDone] = useLocalState(false);
  useSideEffect(() => {
    setDone(true);
  }, []);
  return done;
}

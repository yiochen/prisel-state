import { useEffect, useState } from "../src/index";

export function awaitTimeout(timeMs: number = 0) {
  return new Promise((resolve) => setTimeout(resolve, timeMs));
}

export function useNextTick() {
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(true);
  }, []);
  return done;
}

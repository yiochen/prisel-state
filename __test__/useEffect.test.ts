import { endState, newEvent, run, useEffect, useEvent } from "../src/index";

test("useEffect no deps", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let sideEffectCount = 0;
  function myState() {
    useEffect(() => {
      sideEffectCount++;
    });
    useEvent(triggered);
  }
  run(myState);
  expect(sideEffectCount).toBe(1);
  trigger.send();
  await Promise.resolve();
  expect(sideEffectCount).toBe(2);
});

test("useEffect with cleanup", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let cleanupCount = 0;
  function myState() {
    useEffect(() => {
      return () => {
        cleanupCount++;
      };
    });
    useEvent(triggered);
  }
  run(myState);
  expect(cleanupCount).toBe(0);
  trigger.send();
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

test("useEffect with dep", async () => {
  const [triggered, trigger] = newEvent("trigger");

  let sideEffectCount = 0;
  let cleanupCount = 0;
  let dep = 0;
  function myState() {
    useEvent(triggered);
    useEffect(() => {
      sideEffectCount++;
      return () => {
        cleanupCount++;
      };
    }, [dep]);
  }
  run(myState);
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
  // without changing dep
  trigger.send();
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
  // change dep
  dep = 2;
  trigger.send();
  await Promise.resolve();
  expect(sideEffectCount).toBe(2);
  expect(cleanupCount).toBe(1);
});

test("useEffect with empty array dep", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let sideEffectCount = 0;
  let cleanupCount = 0;
  function myState() {
    useEvent(triggered);
    useEffect(() => {
      sideEffectCount++;
      return () => {
        cleanupCount++;
      };
    }, []);
  }

  run(myState);
  trigger.send();
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
});

test("transition should call cleanupFunc", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let cleanupCount = 0;
  function myState() {
    const triggerResult = useEvent(triggered);
    useEffect(() => {
      return () => {
        cleanupCount++;
      };
    }, []);
    if (triggerResult) {
      return endState();
    }
  }

  run(myState);
  trigger.send();
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

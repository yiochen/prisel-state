import { endState, newEvent, run, useEvent, useSideEffect } from "../src/index";

test("useSideEffect no deps", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let sideEffectCount = 0;
  function myState() {
    useSideEffect(() => {
      sideEffectCount++;
    });
    useEvent(triggered);
  }
  run(myState);
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  trigger.send();
  await Promise.resolve();
  expect(sideEffectCount).toBe(2);
});

test("useSideEffect with cleanup", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let cleanupCount = 0;
  function myState() {
    useSideEffect(() => {
      return () => {
        cleanupCount++;
      };
    });
    useEvent(triggered);
  }
  run(myState);
  await Promise.resolve();
  expect(cleanupCount).toBe(0);
  trigger.send();
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

test("useSideEffect with dep", async () => {
  const [triggered, trigger] = newEvent("trigger");

  let sideEffectCount = 0;
  let cleanupCount = 0;
  let dep = 0;
  function myState() {
    useEvent(triggered);
    useSideEffect(() => {
      sideEffectCount++;
      return () => {
        cleanupCount++;
      };
    }, [dep]);
  }
  run(myState);
  await Promise.resolve();
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

test("useSideEffect with empty array dep", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let sideEffectCount = 0;
  let cleanupCount = 0;
  function myState() {
    useEvent(triggered);
    useSideEffect(() => {
      sideEffectCount++;
      return () => {
        cleanupCount++;
      };
    }, []);
  }

  run(myState);
  await Promise.resolve();
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
    useSideEffect(() => {
      return () => {
        cleanupCount++;
      };
    }, []);
    if (triggerResult) {
      return endState();
    }
  }

  run(myState);
  await Promise.resolve();
  trigger.send();
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

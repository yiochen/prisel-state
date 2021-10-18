import { endState, newEvent, run, useEvent, useSideEffect } from "../index";

test("useSideEffect no deps", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let sideEffectCount = 0;
  function myState() {
    useSideEffect(() => {
      sideEffectCount++;
    });
    useEvent(triggered);
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  inspector.send(trigger);
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
  const inspector = run(myState);
  await Promise.resolve();
  expect(cleanupCount).toBe(0);
  inspector.send(trigger);
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
  const inspector = run(myState);
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
  // without changing dep
  inspector.send(trigger);
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
  // change dep
  dep = 2;
  inspector.send(trigger);
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

  const inspector = run(myState);
  await Promise.resolve();
  inspector.send(trigger);
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

  const inspector = run(myState);
  await Promise.resolve();
  inspector.send(trigger);
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

import { endState, run, useEvent, useSideEffect } from "../index";

test("useSideEffect no deps", async () => {
  let sideEffectCount = 0;
  function myState() {
    useSideEffect(() => {
      sideEffectCount++;
    });
    useEvent("trigger");
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  inspector.send("trigger");
  await Promise.resolve();
  expect(sideEffectCount).toBe(2);
});

test("useSideEffect with cleanup", async () => {
  let cleanupCount = 0;
  function myState() {
    useSideEffect(() => {
      return () => {
        cleanupCount++;
      };
    });
    useEvent("trigger");
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(cleanupCount).toBe(0);
  inspector.send("trigger");
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

test("useSideEffect with dep", async () => {
  let sideEffectCount = 0;
  let cleanupCount = 0;
  let dep = 0;
  function myState() {
    useEvent("trigger");
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
  inspector.send("trigger");
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
  // change dep
  dep = 2;
  inspector.send("trigger");
  await Promise.resolve();
  expect(sideEffectCount).toBe(2);
  expect(cleanupCount).toBe(1);
});

test("useSideEffect with empty array dep", async () => {
  let sideEffectCount = 0;
  let cleanupCount = 0;
  function myState() {
    useEvent("trigger");
    useSideEffect(() => {
      sideEffectCount++;
      return () => {
        cleanupCount++;
      };
    }, []);
  }

  const inspector = run(myState);
  await Promise.resolve();
  inspector.send("trigger");
  await Promise.resolve();
  expect(sideEffectCount).toBe(1);
  expect(cleanupCount).toBe(0);
});

test("transition should call cleanupFunc", async () => {
  let cleanupCount = 0;
  function myState() {
    const [triggered] = useEvent("trigger");
    useSideEffect(() => {
      return () => {
        cleanupCount++;
      };
    }, []);
    if (triggered) {
      return endState();
    }
  }

  const inspector = run(myState);
  await Promise.resolve();
  inspector.send("trigger");
  await Promise.resolve();
  expect(cleanupCount).toBe(1);
});

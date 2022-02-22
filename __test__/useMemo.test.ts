import { newEvent, run, useEvent, useMemo } from "../src/index";

test("useMemo computes the value", async () => {
  let captured = 0;
  function MyState() {
    captured = useMemo(() => 1 + 2);
  }

  run(MyState);
  expect(captured).toBe(3);
});

test("useMemo with deps are not recomputed if deps is the same", async () => {
  const compute = jest.fn(() => 1);
  const [triggered, emit] = newEvent("trigger");
  function MyState() {
    useEvent(triggered);
    useMemo(compute, []);
  }
  run(MyState);
  expect(compute.mock.calls.length).toBe(1);
  emit.send();
  await Promise.resolve();
  expect(compute.mock.calls.length).toBe(1);
});

test("useMemo recomput when deps change", async () => {
  let dep = 1;
  let captured = 0;
  const compute = jest.fn(() => dep);
  const [triggered, emit] = newEvent("trigger");
  function MyState() {
    useEvent(triggered);
    captured = useMemo(compute, [dep]);
  }

  run(MyState);
  expect(compute.mock.calls.length).toBe(1);
  expect(captured).toBe(1);
  emit.send();
  await Promise.resolve();
  expect(compute.mock.calls.length).toBe(1);
  dep = 2;
  emit.send();
  await Promise.resolve();
  expect(compute.mock.calls.length).toBe(2);
  expect(captured).toBe(2);
});

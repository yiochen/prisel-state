import { newEvent, run, useComputed, useEvent } from "../index";

test("useComputed computes the value", async () => {
  let captured = 0;
  function MyState() {
    captured = useComputed(() => 1 + 2);
  }

  run(MyState);
  await Promise.resolve();
  expect(captured).toBe(3);
});

test("useComputed with deps are not recomputed if deps is the same", async () => {
  const compute = jest.fn(() => 1);
  const [triggered, emit] = newEvent("trigger");
  function MyState() {
    useEvent(triggered);
    useComputed(compute, []);
  }
  run(MyState);
  await Promise.resolve();
  expect(compute.mock.calls.length).toBe(1);
  emit.send();
  await Promise.resolve();
  expect(compute.mock.calls.length).toBe(1);
});

test("useComputed recomput when deps change", async () => {
  let dep = 1;
  let captured = 0;
  const compute = jest.fn(() => dep);
  const [triggered, emit] = newEvent("trigger");
  function MyState() {
    useEvent(triggered);
    captured = useComputed(compute, [dep]);
  }

  run(MyState);
  await Promise.resolve();
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

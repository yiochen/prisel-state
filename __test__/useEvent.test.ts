import { newEvent, run, useEvent } from "../index";
import { EventResult } from "../src/useEvent";

test("useEvent called when event triggered", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let stateFuncRunCount = 0;
  function myState() {
    stateFuncRunCount++;
    useEvent(triggered);
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(1);
  inspector.send(trigger);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(2);
});

test("useEvent returns triggered boolean and event data", async () => {
  const [triggered, trigger] = newEvent<number>("trigger");
  const [otherEvent, triggerOther] = newEvent("other");
  let triggerResult: EventResult<number>;
  function myState() {
    triggerResult = useEvent(triggered);
    useEvent(otherEvent);
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  inspector.send(trigger, 1);
  await Promise.resolve();
  expect(triggerResult).toBeDefined();
  if (triggerResult) {
    expect(triggerResult.value).toBe(1);
  }
  inspector.send(triggerOther);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  inspector.send(trigger, 3);
  await Promise.resolve();
  expect(triggerResult).toBeDefined();
  if (triggerResult) {
    expect(triggerResult.value).toBe(3);
  }
});

test("event filter", async () => {
  const [triggered, trigger] = newEvent<number>("trigger");
  let triggerResult: EventResult<number>;
  const triggerBy5 = triggered.filter((value) => value === 5);

  function MyState() {
    triggerResult = useEvent(triggerBy5);
  }

  const inspector = run(MyState);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  inspector.send(trigger, 2);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  inspector.send(trigger, 5);
  await Promise.resolve();
  expect(triggerResult).toBeDefined();
  if (triggerResult) {
    expect(triggerResult.value).toBe(5);
  }
});

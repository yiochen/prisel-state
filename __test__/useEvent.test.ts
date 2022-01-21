import { newEvent, run, useEvent, useSideEffect } from "../src/index";
import { EventResult } from "../src/useEvent";

test("useEvent called when event triggered", async () => {
  const [triggered, trigger] = newEvent("trigger");
  let stateFuncRunCount = 0;
  function myState() {
    stateFuncRunCount++;
    useEvent(triggered);
  }
  run(myState);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(1);
  trigger.send();
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(2);
});

test("dispatch event to newly created state", (done) => {
  const [triggered, trigger] = newEvent("trigger");
  function myState() {
    const triggerResult = useEvent(triggered);
    useSideEffect(() => {
      if (triggerResult) {
        done();
      }
    });
  }
  run(myState);
  trigger.send();
});

test("useEvent returns triggered boolean and event data", async () => {
  const [triggered, trigger] = newEvent<number>("trigger");
  const [otherEvent, triggerOther] = newEvent("other");
  let triggerResult: EventResult<number>;
  function myState() {
    triggerResult = useEvent(triggered);
    useEvent(otherEvent);
  }
  run(myState);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  trigger.send(1);
  await Promise.resolve();
  expect(triggerResult).toBeDefined();
  if (triggerResult) {
    expect(triggerResult.value).toBe(1);
  }
  triggerOther.send();
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  trigger.send(3);
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

  run(MyState);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  trigger.send(2);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  trigger.send(5);
  await Promise.resolve();
  expect(triggerResult).toBeDefined();
  if (triggerResult) {
    expect(triggerResult.value).toBe(5);
  }
});

test("event map", async () => {
  const [triggered, trigger] = newEvent<number>("trigger");
  let triggerResult: EventResult<number>;

  function MyState() {
    triggerResult = useEvent(triggered.map((value) => value + 1));
  }

  run(MyState);
  await Promise.resolve();
  expect(triggerResult).toBeUndefined();
  trigger.send(1);
  await Promise.resolve();
  expect(triggerResult?.value).toBe(2);
});

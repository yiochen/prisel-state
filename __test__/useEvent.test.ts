import { run, useEvent } from "../index";

test("useEvent called when event triggered", async () => {
  let stateFuncRunCount = 0;
  function myState() {
    stateFuncRunCount++;
    useEvent("triggered");
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(1);
  inspector.send("triggered");
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(2);
});

test("useEvent returns triggered boolean and event data", async () => {
  let triggered = false;
  let eventData: any = undefined;
  function myState() {
    const event = useEvent("triggered");
    useEvent("other");
    triggered = event[0];
    eventData = event[1];
  }
  const inspector = run(myState);
  await Promise.resolve();
  expect(triggered).toBe(false);
  expect(eventData).toBeUndefined();
  inspector.send("triggered", 1);
  await Promise.resolve();
  expect(triggered).toBe(true);
  expect(eventData).toBe(1);
  inspector.send("other");
  await Promise.resolve();
  expect(triggered).toBe(false);
  expect(eventData).toBeUndefined();
  inspector.send("triggered", 3);
  await Promise.resolve();
  expect(triggered).toBe(true);
  expect(eventData).toBe(3);
});

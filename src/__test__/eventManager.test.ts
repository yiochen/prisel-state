import { newEvent } from "../event";
import { run } from "../run";
import { useEvent } from "../useEvent";

describe("send", () => {
  test("should try all subscribing states", async () => {
    const [event, emitter] = newEvent("trigger");
    let state1Ran = 0;
    function State1() {
      state1Ran++;
      useEvent(event);
    }
    let state2Ran = 0;
    function State2() {
      state2Ran++;
      useEvent(event);
    }
    let state3Ran = 0;
    function State3() {
      state3Ran++;
    }
    run(State1);
    run(State2);
    run(State3);
    await Promise.resolve();
    emitter.send();
    await Promise.resolve();
    expect(state1Ran).toBe(2);
    expect(state2Ran).toBe(2);
    expect(state3Ran).toBe(1);
  });
});

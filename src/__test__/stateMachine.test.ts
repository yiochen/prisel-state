import { newEvent } from "../event";
import { machine } from "../machine";
import { newState } from "../newState";
import { State } from "../state";
import { EventResult, useEvent } from "../useEvent";

describe("subscribe", () => {
  test("subscribe current processing state", async () => {
    const [event, emitter] = newEvent("trigger");
    let eventCaptor: EventResult<undefined>;
    let otherStateTriggerCount = 0;
    const state = State.builder()
      .machine(machine)
      .config(
        newState(() => {
          eventCaptor = useEvent(event);
        })
      )
      .id("123")
      .build();

    const otherState = State.builder()
      .machine(machine)
      .config(
        newState(() => {
          otherStateTriggerCount++;
        })
      )
      .id("456")
      .build();

    machine.addState(otherState);
    machine.addState(state);

    machine.schedule();
    await Promise.resolve();
    expect(otherStateTriggerCount).toBe(1);
    emitter.send();
    machine.schedule();
    await Promise.resolve();
    expect(eventCaptor).toBeDefined();
    expect(otherStateTriggerCount).toBe(1);
  });
});

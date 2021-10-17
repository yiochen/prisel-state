import { Hook, HookType } from "./hook";
import { machine } from "./machine";

export interface EventHook extends Hook {
  type: HookType.EVENT;
  eventName: string;
  eventData: any;
  eventTriggered: boolean;
}
/**
 * Subscribe to an event specified by the `eventName`. When the event is
 * triggered, `useEvent` will return `[true, eventData]`, otherwise it will
 * return `[false, undefined]`.
 * @param eventName The name of the event.
 * @returns `[true, eventData]` if StateFunc is run because of the event or
 * `[false, undefined]` if otherwise.
 */
export function useEvent<EventDataT = undefined>(
  eventName: string
): [boolean, EventDataT | undefined] {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useState outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: EventHook = {
      type: HookType.EVENT,
      eventName,
      eventData: undefined,
      eventTriggered: false,
    };
    processingState.setHook(newQueueItem);
  }

  const eventHook = processingState.getHook(HookType.EVENT);
  // If eventName changed, we will start listening for new event in next turn.
  // For current turn, we will still return event for current event.
  eventHook.eventName = eventName;
  if (eventHook.eventTriggered) {
    eventHook.eventTriggered = false;
    const eventData = eventHook.eventData;
    eventHook.eventData = undefined;
    return [true, eventData];
  }
  return [false, undefined];
}

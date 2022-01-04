import { AssertionError } from "./errors";
import type { Event } from "./event";
import { EventImpl } from "./event";
import type { Hook } from "./hook";
import { HookType } from "./hook";
import { machine } from "./machine";

export interface EventHook extends Hook {
  type: HookType.EVENT;
  event: EventImpl<any>;
  eventData: any;
  eventTriggered: boolean;
}

/**
 * Nullable wrapper over the event data.
 */
export type EventResult<EventDataT> = { value: EventDataT } | undefined;

/**
 * Subscribe to an event specified by the `eventName`. When the event is
 * triggered, `useEvent` will return non-null {@linkcode EventResult}, otherwise it will
 * return `undefined`.
 * @param event The name of the event.
 * @typeparam EventDataT Type of tthe event data.
 * @returns {@linkcode EventResult} containing the event data if StateFunc is
 * run because of the event or `undefined` if otherwise.
 * @category Hook
 */
export function useEvent<EventDataT = undefined>(
  event: Event<EventDataT>
): EventResult<EventDataT> | undefined {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new AssertionError(
      "Cannot useState outside of state machine scope",
      useEvent
    );
  }
  processingState.incrementHookId();
  if (!(event instanceof EventImpl)) {
    throw new AssertionError(
      "useEvent needs to receive event returned from newEvent",
      useEvent
    );
  }
  if (!processingState.isHookAdded()) {
    const newQueueItem: EventHook = {
      type: HookType.EVENT,
      event,
      eventData: undefined,
      eventTriggered: false,
    };
    processingState.setHook(newQueueItem);
  }

  const eventHook = processingState.getHook(HookType.EVENT);
  // If event changed, we will start listening for new event in next turn.
  // For current turn, we will still return event for current event.
  eventHook.event = event;
  machine.subscribe(event);
  if (eventHook.eventTriggered) {
    eventHook.eventTriggered = false;
    const eventData = eventHook.eventData;
    eventHook.eventData = undefined;
    return { value: eventData };
  }
  return undefined;
}

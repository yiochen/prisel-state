import { Emitter } from "./event";
import { machine } from "./machine";

/**
 * Object return by `run(stateFunc)`. Inspector can be used to send event to state
 */
export interface Inspector {
  /**
   * Send event to the states in the same chain as the starting state
   */
  send<EventDataT>(
    eventEmitter: Emitter<EventDataT>,
    eventData: EventDataT
  ): void;
  send(eventEmitter: Emitter<undefined>): void;

  /** Print debug information for the all states in state machine. */
  debugStates: () => void;
}

export function createInspector(id: string): Inspector {
  return {
    send(eventEmitter: Emitter<any>, eventData?: any) {
      machine.send(eventEmitter, eventData);
    },
    debugStates() {
      machine.debugStates();
    },
  };
}

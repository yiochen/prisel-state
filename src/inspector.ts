import { machine } from "./machine";

/**
 * Object return by `run(stateFunc)`. Inspector can be used to send event to state
 */
export interface Inspector {
  /**
   * Send event to the states in the same chain as the starting state
   */
  send: (event: string, eventData?: any) => void;
  /**
   * Send event to all active states in the state machine.
   */
  sendAll: (event: string, eventData?: any) => void;

  /** Print debug information for the all states in state machine. */
  debugStates: () => void;
}

export function createInspectorForId(id: string): Inspector {
  return {
    send(event: string, eventData: any) {
      machine.sendAllForId(id, event, eventData);
    },
    sendAll: machine.sendAll.bind(machine),
    debugStates() {
      machine.debugStates();
    },
  };
}

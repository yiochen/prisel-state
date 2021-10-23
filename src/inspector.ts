/**
 * Object return by `run(stateFunc)`. Inspector can be used to retrieve the
 * status of state machine.
 */
export interface Inspector {
  /** Print debug information for the all states in state machine. */
  debugStates: () => void;
}

export interface StateDebugInfo {
  chainId: string;
  label?: string;
  dirty: boolean;
  hookCount?: number;
  props: any;
}
/**
 * Object return by `run(stateFunc)`. Inspector can be used to retrieve the
 * status of state machine.
 */
export interface Inspector {
  /** Print debug information for the all states in state machine. */
  debugStates: () => StateDebugInfo[];
  exit: () => void;
  onComplete: (callback: () => unknown) => void;
}

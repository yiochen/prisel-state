export interface StateDebugInfo {
  chainId: string;
  label?: string;
  dirty: boolean;
  hookCount?: number;
  props: any;
  stack: string[];
}
/**
 * Object return by `run(stateFunc)`. Inspector can be used to retrieve the
 * status of state machine.
 */
export interface Inspector {
  /** Print debug information for the all states in state machine. null if the
   * state is already removed */
  debugStates: () => StateDebugInfo | null;
  exit: () => void;
  onComplete: (callback: () => unknown) => void;
}

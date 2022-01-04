import type { Inspector } from "./inspector";
import { machine } from "./machine";
import { newState } from "./newState";
import type { StateFunc } from "./state";
import { State, StateConfig } from "./state";

export function internalRun(stateConfig: StateConfig<any>): Inspector {
  const stateKey = machine.genChainId();
  const stateBuilder = State.builder()
    .machine(machine)
    .config(stateConfig)
    .id(stateKey);

  const ambientState = machine.getProcessingState();
  const state = ambientState
    ? stateBuilder.ambientState(ambientState).parent(ambientState).build()
    : stateBuilder.build();
  machine.addState(state);

  return {
    debugStates: () => {
      const currentStateOfChain = machine.getStateByChainId(stateKey);
      if (currentStateOfChain) {
        return currentStateOfChain.getDebugInfo();
      }
      return null;
    },
    exit: () => machine.closeState(stateKey),
    onComplete: (callback) => {
      machine.addOnComplete(stateKey, callback);
    },
  };
}
/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state State to run as the initial state.
 * @param props Props to be passed to the state func to initialize the state.
 */
export function run<PropT>(state: StateFunc<PropT>, prop: PropT): Inspector;
/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state State to run as the initial state.
 */
export function run(state: StateFunc<undefined>): Inspector;
/**
 * State the state machine with the given {@linkcode StateConfig}. StateConfig
 * is returned from {@linkcode newState} or {@linkcode endState}.
 * @param stateConfig A wrapper for state function and props to be passed to the
 * state when starting.
 */
export function run<PropT>(stateConfig: StateConfig<PropT>): Inspector;
export function run(
  state: StateFunc<any> | StateConfig<any>,
  ...props: any[]
): Inspector {
  if (typeof state === "function") {
    if (props.length === 0) {
      return internalRun(newState(state as any));
    }
    return internalRun(newState(state, props[0]));
  }
  return internalRun(state);
}

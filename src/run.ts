import { provideInspector } from "./ambients";
import type { Inspector } from "./inspector";
import { machine } from "./machine";
import { newState } from "./newState";
import { State } from "./state";
import type { StateConfig, StateFunc } from "./stateConfig";

export function internalRun(stateConfig: StateConfig<any>): Inspector {
  const stateKey = machine.genChainId();
  const inspector: Inspector = {
    debugStates: () => {
      const currentStateOfChain = machine.getStateByChainId(stateKey);
      if (currentStateOfChain) {
        return currentStateOfChain.getDebugInfo();
      }
      return null;
    },
    exit: () => {
      const state = machine.getStateByChainId(stateKey);
      if (state) {
        state.cancel();
        machine.removeOnComplete(state.chainId);
      }
    },
    onComplete: (callback) => {
      machine.addOnComplete(stateKey, callback);
    },
  };

  const stateConfigWithInspector = provideInspector(inspector, stateConfig);

  const stateBuilder = State.builder()
    .machine(machine)
    .config(stateConfigWithInspector)
    .id(stateKey);

  const ambientState = machine.getProcessingState();

  const state = ambientState
    ? stateBuilder.ambientState(ambientState).parent(ambientState).build()
    : stateBuilder.build();

  machine.addState(state); // add the state and immediately run

  return inspector;
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

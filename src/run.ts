import { createInspector, Inspector } from "./inspector";
import { machine } from "./machine";
import { newState } from "./newState";
import { State, StateFunc } from "./state";

export interface RunConfig {
  id(id: string): RunConfig;
  start<PropT>(state: StateFunc<PropT>, prop: PropT): Inspector;
  start<PropT = undefined>(state: StateFunc<PropT>): Inspector;
}

function internalRun(
  state: StateFunc<any>,
  props: any,
  id: string | undefined
): Inspector {
  const stateKey = id ?? machine.genChainId();
  const createdState = State.builder()
    .machine(machine)
    .config(newState(state, props))
    .id(stateKey)
    .inspector(createInspector(stateKey))
    .build();

  machine.addState(createdState);
  machine.schedule();
  return createdState.inspector;
}
/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state State to run as the initial state.
 * @param props Props to be passed to the state func to initialize the state.
 */
export function run<PropT>(state: StateFunc<PropT>, prop: PropT): Inspector;
export function run<PropT = undefined>(state: StateFunc<PropT>): Inspector;
export function run(): RunConfig;
export function run(
  state?: StateFunc<any>,
  props?: any
): Inspector | RunConfig {
  let forcedId: string | undefined = undefined;
  if (state === undefined) {
    const runConfig: RunConfig = {
      id: (id) => {
        forcedId = id;
        return runConfig;
      },
      start: (state?, props?) => internalRun(state, props, forcedId),
    };
    return runConfig;
  }
  return internalRun(state, props, undefined);
}

import { StateConfig, StateFunc } from "./state";

/**
 * Create a StateConfig. StateConfig contains StateFunc and props. It is used to
 * instruct state machine on the new state to create.
 * @param nextState The StateFunc for the new state
 * @param props Props to be passed to StateFunc to initialize the state
 * @typeparam PropT Type of the props to be passed to the state.
 * @returns {@linkcode StateConfig} of the next state.
 * @category State creation
 */
export function newState<PropT>(
  nextState: StateFunc<PropT>,
  props: PropT
): StateConfig<PropT>;
/**
 * Create a StateConfig. StateConfig contains StateFunc and props. It is used to
 * instruct state machine on the new state to create.
 * @param nextState The StateFunc for the new state
 * @param props Props to be passed to StateFunc to initialize the state
 * @returns {@linkcode StateConfig} of the next state.
 * @category State creation
 */
export function newState(
  newState: StateFunc<undefined>
): StateConfig<undefined>;
export function newState(nextState: StateFunc<any>, props?: any) {
  return {
    stateFunc: nextState,
    props,
  };
}

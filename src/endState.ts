import { machine } from "./machine";
import { State, StateConfig, StateFunc } from "./state";
import { useSideEffect } from "./useSideEffect";

const END_STATE_FUNC: StateFunc<any> = () => {
  useSideEffect(() => {
    const currentState = machine.getProcessingState();
    // if there is an parent state, mark it as dirty, so that next iteration
    // will run and detect that child is ended.
    currentState?.parentState?.markDirty();
    if (currentState && currentState?.parentState === undefined) {
      // if no parent state, then we can remove this state chain
      // nested states will continue to live at end state to provide result to
      // parent state. But they will be removed when parent state transitions.
      machine.removeState(currentState);
    }
  }, []);
};

export function isEndState(state: State) {
  return state.config.stateFunc === END_STATE_FUNC;
}
/**
 * Create a ending StateConfig. Ending StateConfig denotes an end state of a
 * state flow.
 * @param props Props to the end state.
 * @typeparam PropT Type of the props to be passed to state.
 * @returns {@linkcode StateConfig} for the end state.
 * @category State creation
 */
export function endState<PropT>(props: PropT): StateConfig<PropT>;
/**
 * Create a ending StateConfig. Ending StateConfig denotes an end state of a
 * state flow.
 * @returns {@linkcode StateConfig} for the end state.
 * @category State creation
 */
export function endState(): StateConfig<undefined>;
export function endState(props?: any) {
  return { stateFunc: END_STATE_FUNC, props };
}

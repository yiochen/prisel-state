import { machine } from "./machine";
import type { StateConfig, StateFunc } from "./state";
import { State } from "./state";
import { useSideEffect } from "./useSideEffect";

const END_STATE_FUNC: StateFunc<{ onEnd: () => void }> = (props) => {
  useSideEffect(() => {
    props.onEnd();
    const currentState = machine.getProcessingState();
    machine.closeState(currentState?.chainId!);
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
export function endState(
  props: {
    onEnd: () => void;
  } = { onEnd: () => {} }
): StateConfig<{ onEnd: () => void }> {
  return { stateFunc: END_STATE_FUNC, props };
}

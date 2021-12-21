import { machine } from "./machine";
import type { StateConfig, StateFunc } from "./state";
import { createStateConfig, State } from "./state";
import { useSideEffect } from "./useSideEffect";
import { ImmutableMap } from "./utils";

const END_STATE_FUNC: StateFunc<{ onEnd: () => void }> = (props) => {
  useSideEffect(() => {
    props.onEnd();
    const currentState = machine.getProcessingState();
    machine.runOnCompletes(currentState?.chainId!);
    machine.closeState(currentState?.chainId!);
  }, []);
};

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
  return createStateConfig(END_STATE_FUNC, props, ImmutableMap.builder());
}

export function isEndState(stateConfig: StateConfig<any>): boolean;
export function isEndState(state: State): boolean;
export function isEndState(state: State | StateConfig<any>) {
  if (state instanceof State) {
    return state.stateFunc === END_STATE_FUNC;
  }
  return state.stateFunc === END_STATE_FUNC;
}

import { newAmbient } from "./ambient";
import { getAmbient } from "./getAmbient";
import { machine } from "./machine";
import { createStateConfig, State, StateConfig, StateFunc } from "./state";
import { useSideEffect } from "./useSideEffect";
import { ImmutableMap } from "./utils";

export const [endStateCallbackAmbient, provideEndStateCallback] =
  newAmbient<() => void>("endStateCallback");
const END_STATE_FUNC: StateFunc<{ onEnd: () => void }> = (props) => {
  // TODO check if there is an ambient for end emitter, passed from `sequence`.
  useSideEffect(() => {
    props.onEnd();
    getAmbient(endStateCallbackAmbient, () => {})();
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
  return createStateConfig(END_STATE_FUNC, props, ImmutableMap.builder());
}

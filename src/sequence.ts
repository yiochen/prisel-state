import { endState } from "./endState";
import { newState } from "./newState";
import { StateConfig } from "./state";

/**
 * Run a sequence of states in order. When a state reaches an end state, the
 * next state will start.
 * @param stateConfigs A sequence of states
 * @param onEnd Callback called when the last state ends
 * @returns {@linkcode StateConfig} for a wrapper state that manages the
 * sequenced states.
 */
export function sequence(
  stateConfigs: IterableIterator<StateConfig<any>> | Array<StateConfig<any>>,
  onEnd: () => unknown = () => {}
): StateConfig<{ onEnd: () => unknown }> {
  const stateConfigIterator = Array.isArray(stateConfigs)
    ? stateConfigs.values()
    : stateConfigs;
  function* SequenceState(props: { onEnd: () => unknown }) {
    for (const state of stateConfigIterator) {
      yield state;
    }

    return endState(props);
  }

  return newState(SequenceState, { onEnd });
}

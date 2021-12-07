import {
  endState,
  endStateCallbackAmbient,
  provideEndStateCallback,
} from "./endState";
import { newEvent } from "./event";
import { getAmbient } from "./getAmbient";
import { newState } from "./newState";
import { run } from "./run";
import { StateConfig } from "./state";
import { useEvent } from "./useEvent";
import { useLocalState } from "./useLocalState";
import { useSideEffect } from "./useSideEffect";
import { useStored } from "./useStored";

/**
 * Run a sequence of states in order. When a state reaches an end state, the
 * next state will start.
 * @param stateConfigs A sequence of states
 * @param onEnd Callback called when the last state ends
 * @returns {@linkcode StateConfig} for a wrapper state that manages the
 * sequenced states.
 */
export function sequence(
  stateConfigs: Iterator<StateConfig<any>> | Array<StateConfig<any>>,
  onEnd: () => unknown = () => {}
): StateConfig<{ onEnd: () => unknown }> {
  const stateConfigIterator = Array.isArray(stateConfigs)
    ? stateConfigs.values()
    : stateConfigs;
  const [event, emitter] = newEvent<number>("iterator index");
  let index = 0;
  function SequenceState(props: { onEnd: () => unknown }) {
    const { onEnd } = props;
    const currentIndexEvent = useEvent(event);
    const currentIndexRef = useStored(0);
    const [done, setDone] = useLocalState(false);
    if (currentIndexEvent) {
      currentIndexRef.current = currentIndexEvent.value;
    }
    const currentEndStateCallback = getAmbient(
      endStateCallbackAmbient,
      () => {}
    );
    useSideEffect(() => {
      if (done) {
        return;
      }

      const { done: finishedAllStates, value: stateConfig } =
        stateConfigIterator.next();
      if (finishedAllStates) {
        setDone(true);
      } else {
        run(
          provideEndStateCallback(() => {
            index++;
            emitter.send(index);
            currentEndStateCallback();
          }, stateConfig)
        );
      }
    }, [done, currentIndexRef.current]);
    if (done) {
      return endState({ onEnd });
    }
  }

  return newState(SequenceState, { onEnd });
}

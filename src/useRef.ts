import { AssertionError } from "./errors";
import type { Hook } from "./hook";
import { HookType } from "./hook";
import { machine } from "./machine";

export interface RefHook<T> extends Hook {
  type: HookType.REF;
  ref: { current: T };
}

/**
 * Return a reference value stored with the state. Mutating the value by setting
 * `current` will not trigger rerun of the state function.
 * @param initialValue Initial value to be stored with the state.
 * @returns Object with `current` storing the value.
 * @category Hook
 */
export function useRef<T>(initialValue: T): { current: T } {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new AssertionError(
      "Cannot useState outside of state machine scope",
      useRef
    );
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: RefHook<T> = {
      type: HookType.REF,
      ref: { current: initialValue },
    };
    processingState.setHook(newQueueItem);
  }
  const queueItem = processingState.getHook(HookType.REF);
  return queueItem.ref;
}

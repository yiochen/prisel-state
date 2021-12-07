import type { Hook } from "./hook";
import { HookType } from "./hook";
import { machine } from "./machine";

export interface StoredHook<T> extends Hook {
  type: HookType.STORED;
  ref: { current: T };
}

/**
 * Return a reference value stored with the state. Mutating the value by setting
 * `current` will not trigger rerun of the state function.
 * @param initialValue Initial value to be stored with the state.
 * @returns Object with `current` storing the value.
 * @category Hook
 */
export function useStored<T>(initialValue: T): { current: T } {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useLocalState outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: StoredHook<T> = {
      type: HookType.STORED,
      ref: { current: initialValue },
    };
    processingState.setHook(newQueueItem);
  }
  const queueItem = processingState.getHook(HookType.STORED);
  return queueItem.ref;
}

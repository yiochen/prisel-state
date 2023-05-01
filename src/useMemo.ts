import { AssertionError } from "./errors";
import { Hook, HookType } from "./hook";
import { machine } from "./machine";
import { AllDeps, unchangedDeps } from "./utils";

export interface MemoHook extends Hook {
  type: HookType.MEMO;
  memo: any;
  deps: any[] | undefined;
}

/**
 * Compute a value and memorize it.
 *
 * @param calculateValue A function to compute the value. The value will be memorized
 * and not computed again unless `deps` changed.
 * @param dependencies If present, value will be recomputed only when deps changes.
 * @typeparam ValueT The type of the computed value.
 * @returns The computed value.
 * @category Hook
 */
export function useMemo<ValueT>(
  calculateValue: () => ValueT,
  dependencies: any[] | undefined = AllDeps
): ValueT {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new AssertionError(
      "Cannot call useMemo outside of state machine scope",
      useMemo
    );
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: MemoHook = {
      type: HookType.MEMO,
      memo: undefined,
      deps: undefined, // undefined deps guaranteed compute to run later because unchangedDeps with undefined will return false
    };
    processingState.setHook(newQueueItem);
  }
  const queueItem: MemoHook = processingState.getHook(HookType.MEMO);
  if (!unchangedDeps(queueItem.deps, dependencies)) {
    queueItem.memo = calculateValue();
    queueItem.deps = dependencies;
  }
  return queueItem.memo;
}

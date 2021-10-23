import { Hook, HookType } from "./hook";
import { machine } from "./machine";
import { AllDeps, unchangedDeps } from "./utils";

export interface ComputedHook extends Hook {
  type: HookType.COMPUTED;
  memo: any;
  deps: any[] | undefined;
}

/**
 * Compute a value and memorize it.
 *
 * @param compute A function to compute the value. The value will be memorized
 * and not computed again unless `deps` changed.
 * @param deps If present, value will be recomputed only when deps changes.
 * @typeparam ValueT The type of the computed value.
 * @returns The computed value.
 */
export function useComputed<ValueT>(
  compute: () => ValueT,
  deps: any[] | undefined = AllDeps
): ValueT {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot call useComputed outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: ComputedHook = {
      type: HookType.COMPUTED,
      memo: undefined,
      deps: undefined, // undefined deps guaranteed compute to run later because unchangedDeps with undefined will return false
    };
    processingState.setHook(newQueueItem);
  }
  const queueItem: ComputedHook = processingState.getHook(HookType.COMPUTED);
  if (!unchangedDeps(queueItem.deps, deps)) {
    queueItem.memo = compute();
    queueItem.deps = deps;
  }
  return queueItem.memo;
}

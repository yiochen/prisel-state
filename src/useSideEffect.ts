import { Hook, HookType } from "./hook";
import { machine } from "./machine";
import { AllDeps, unchangedDeps } from "./utils";

type EffectFunc = () => (() => void) | void;

export interface EffectHook extends Hook {
  type: HookType.EFFECT;
  effectFunc: EffectFunc | undefined;
  cleanupFunc: (() => unknown) | undefined;
  deps: any[] | undefined;
}

/**
 * useSideEffect is used to perform side effects.
 * @param effectFunc
 * @param deps
 */
export function useSideEffect(
  effectFunc: EffectFunc,
  deps: any[] | AllDeps = AllDeps
) {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useState outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: EffectHook = {
      type: HookType.EFFECT,
      effectFunc: effectFunc,
      cleanupFunc: undefined, // cleanup func might be populated when effectFunc is run after the state func.
      deps: undefined,
    };
    processingState.setHook(newQueueItem);
  }
  const queueItem: EffectHook = processingState.getHook(HookType.EFFECT);
  if (unchangedDeps(queueItem.deps, deps)) {
    // dependencies are not changed. We don't need to execute the effectFunc
    return;
  }
  // deps changed. We will store the new deps as well as the effectFunc.
  queueItem.effectFunc = effectFunc;
  queueItem.deps = deps;
  if (queueItem.cleanupFunc != undefined) {
    // if there is a previous cleanup, we will call, because we are changing
    // deps
    queueItem.cleanupFunc();
  }
  queueItem.cleanupFunc = undefined; // cleanup func will be assigned when effectFunc is run
  return;
}

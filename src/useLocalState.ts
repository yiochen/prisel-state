import { AssertionError } from "./errors";
import type { Hook } from "./hook";
import { HookType } from "./hook";
import { machine } from "./machine";
import { StateLifecycle } from "./state";

/**
 * Return type of {@linkcode useLocalState}.
 */
export interface SetLocalState<StateT> {
  (value: StateT | ((prevState: StateT) => StateT)): void;
}

export interface LocalStateHook<T> extends Hook {
  type: HookType.LOCAL_STATE;
  value: T | undefined;
  setLocalState: SetLocalState<T>;
}

/**
 * Returns a stateful value, and a function to update it.
 * @param initialState Initial state value.
 * @typeParam StateT Type of the stateful value.
 * @returns A tuple of current state value and update function.
 * @category Hook
 */
export function useLocalState<StateT>(
  initialState: StateT
): [StateT, SetLocalState<StateT>];
/**
 * Returns a stateful value, and a function to update it. The initial value is
 * set to undefined.
 * @typeParam StateT Type of the stateful value.
 * @returns A tuple of current state value and update function.
 * @category Hook
 */
export function useLocalState<StateT = undefined>(): [
  StateT | undefined,
  SetLocalState<StateT | undefined>
];
export function useLocalState(initialState?: any) {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new AssertionError(
      "Cannot useLocalState outside of state machine scope",
      useLocalState
    );
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    // first time running this hook. Allocate and return.
    const newQueueItem: LocalStateHook<any> = {
      type: HookType.LOCAL_STATE,
      value: initialState,
      setLocalState: (val) => {
        switch (processingState.lifecycle) {
          case StateLifecycle.IDLE:
          case StateLifecycle.SIDE_EFFECT:
          case StateLifecycle.CLEANING_UP:
            if (!processingState.pendingCancel) {
              const newValue =
                typeof val === "function" ? val(newQueueItem.value) : val;
              if (!Object.is(newValue, newQueueItem.value)) {
                processingState.markDirty();
                newQueueItem.value = newValue;
              }
            }
        }
      },
    };
    processingState.setHook(newQueueItem);
  }

  const queueItem: LocalStateHook<any> = processingState.getHook(
    HookType.LOCAL_STATE
  );

  return [queueItem.value, queueItem.setLocalState];
}

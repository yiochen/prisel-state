import { AssertionError } from "./errors";
import type { Hook } from "./hook";
import { HookType } from "./hook";
import { machine } from "./machine";
import { StateLifecycle } from "./stateLifecycle";

/**
 * Return type of {@linkcode useState}.
 */
export interface SetState<StateT> {
  (value: StateT | ((prevState: StateT) => StateT)): void;
}

export interface StateHook<T> extends Hook {
  type: HookType.STATE;
  value: T | undefined;
  setLocalState: SetState<T>;
}

/**
 * Returns a stateful value, and a function to update it.
 * @param initialState Initial state value.
 * @typeParam StateT Type of the stateful value.
 * @returns A tuple of current state value and update function.
 * @category Hook
 */
export function useState<StateT>(
  initialState: StateT
): [StateT, SetState<StateT>];
/**
 * Returns a stateful value, and a function to update it. The initial value is
 * set to undefined.
 * @typeParam StateT Type of the stateful value.
 * @returns A tuple of current state value and update function.
 * @category Hook
 */
export function useState<StateT = undefined>(): [
  StateT | undefined,
  SetState<StateT | undefined>
];
export function useState(initialState?: any) {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new AssertionError(
      "Cannot useState outside of state machine scope",
      useState
    );
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    // first time running this hook. Allocate and return.
    const newQueueItem: StateHook<any> = {
      type: HookType.STATE,
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

  const queueItem: StateHook<any> = processingState.getHook(HookType.STATE);

  return [queueItem.value, queueItem.setLocalState];
}

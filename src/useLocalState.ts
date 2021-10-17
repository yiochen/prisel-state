import { Hook, HookType } from "./hook";
import { machine } from "./machine";

type Dispatch<A> = (value: A) => void;
type SetStateAction<S> = S | ((prevState: S) => S);
type SetLocalState<T> = Dispatch<SetStateAction<T>>;

export interface LocalStateHook<T> extends Hook {
  type: HookType.LOCAL_STATE;
  value: T | undefined;
  setLocalState: SetLocalState<T>;
}

/**
 * Create a state hook.
 * @param initialState
 */
export function useLocalState<S>(initialState: S): [S, SetLocalState<S>];
export function useLocalState<S = undefined>(): [
  S | undefined,
  SetLocalState<S | undefined>
];
export function useLocalState(initialState?: any) {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useLocalState outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    // first time running this hook. Allocate and return.
    const newQueueItem: LocalStateHook<any> = {
      type: HookType.LOCAL_STATE,
      value: initialState,
      setLocalState: (val) => {
        if (!processingState.isActive()) {
          // current state is not active anymore. This means the state is
          // transitioned. We don't do anything.
          return;
        }
        const newValue =
          typeof val === "function" ? val(newQueueItem.value) : val;
        if (!Object.is(newValue, newQueueItem.value)) {
          processingState.markDirty();
          newQueueItem.value = newValue;
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

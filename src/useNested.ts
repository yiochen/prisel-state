import { isEndState } from "./endState";
import { Hook, HookType } from "./hook";
import { machine } from "./machine";
import { newState } from "./newState";
import { State, StateFunc } from "./state";

export interface NestedStateHook extends Hook {
  type: HookType.NESTED_STATE;
  chainId: string | undefined; // chainId undefined means nested state hasn't started.
}

type NestedState = [done: boolean, endStateProps: any];
const nestedStateNotStarted: NestedState = [false, undefined];
const nestedStateNotDone: NestedState = [false, undefined];
/**
 * Add the nested state to state machine.
 * When nested state reaches endState, return done == true and the props to endState.
 * Nested state will be cancelled if parent state transitions away.
 * @param startingCondition the condition for starting nested state. Nested
 * state will start when the condition becomes true. Nested state will only
 * start once in within the scope of parent state.
 * @param stateFunc nested state function. If `stateFunc` is not fixed, the
 * StateFunc when `startingCondition = true` will be used.
 * @param props props to the nested state function. If `props` is not fixed, the
 * `props` when `startingCondition = true` will be used.
 */
export function useNested<PropT>(
  startingCondition: boolean,
  stateFunc: StateFunc<PropT>,
  props: PropT
): NestedState;
export function useNested<PropT = undefined>(
  startingCondition: boolean,
  stateFunc: StateFunc<PropT>
): NestedState;
export function useNested(
  startingCondition: boolean,
  stateFunc: StateFunc<any>,
  props?: any
) {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useNested outside of state machine scope");
  }

  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const nestedStateHook: NestedStateHook = {
      type: HookType.NESTED_STATE,
      chainId: undefined,
    };
    processingState.setHook(nestedStateHook);
  }

  const queueItem = processingState.getHook(HookType.NESTED_STATE);
  if (queueItem.chainId === undefined) {
    // nested state hasn't started yet.
    if (!startingCondition) {
      // cannot start yet
      return nestedStateNotStarted;
    }
    // start nested state
    // nested state will run after the current state.
    const state = State.builder()
      .machine(machine)
      .config(newState(stateFunc, props))
      .id(machine.genChainId())
      .inspector(processingState.inspector)
      .parent(processingState)
      .build();
    machine.addState(state);

    queueItem.chainId = state.chainId;
    return nestedStateNotDone;
  }
  // Nested state is already added. We check if it is ended.
  const state = machine.getStateByChainId(queueItem.chainId);
  if (state && isEndState(state)) {
    return [true, state.config.props];
  }
  return nestedStateNotDone;
}

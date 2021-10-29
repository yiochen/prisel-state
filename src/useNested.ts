import { isEndState } from "./endState";
import { Hook, HookType } from "./hook";
import { machine } from "./machine";
import { newState } from "./newState";
import type { StateConfig, StateFunc } from "./state";
import { State } from "./state";

export interface NestedStateHook extends Hook {
  type: HookType.NESTED_STATE;
  chainId: string | undefined; // chainId undefined means nested state hasn't started.
}

/**
 * Return type of {@link useNested}.
 */
export type NestedState<PropT> = [
  done: boolean,
  endStateProps: PropT | undefined
];

const nestedStateNotStarted: NestedState<any> = [false, undefined];
const nestedStateNotDone: NestedState<any> = [false, undefined];
/**
 * Add the nested state to state machine.
 * When nested state reaches endState, return done == true and the props to endState.
 * Nested state will be cancelled if parent state transitions away.
 * @param startingCondition the condition for starting nested state. Nested
 * state will start when the condition becomes true. Nested state will only
 * start once in within the scope of parent state.
 * @param stateFunc nested state function. If `stateFunc` is not fixed, the
 * StateFunc when `startingCondition = true` will be used.
 * @param props Props to the nested state function. If `props` is not fixed, the
 * current value of `props` when `startingCondition = true` will be used.
 * @typeparam PropT Type of the props to be passed to the nested state.
 * @typeparam EndStatePropT Type of the props to be passed to end state.
 * Transitioning to end state means the nested state is finished. The props to
 * end state will be reported back.
 * @category Hook
 */
export function useNested<PropT, EndStatePropT = any>(
  startingCondition: boolean,
  stateFunc: StateFunc<PropT>,
  props: PropT | (() => PropT)
): NestedState<EndStatePropT>;
/**
 * Add the nested state to state machine.
 * When nested state reaches endState, return done == true and the props to endState.
 * Nested state will be cancelled if parent state transitions away.
 * @param startingCondition the condition for starting nested state. Nested
 * state will start when the condition becomes true. Nested state will only
 * start once in within the scope of parent state.
 * @param stateFunc nested state function. If `stateFunc` is not fixed, the
 * StateFunc when `startingCondition = true` will be used.
 * @typeparam PropT Type of the props to be passed to the nested state.
 * @typeparam EndStatePropT Type of the props to be passed to end state.
 * Transitioning to end state means the nested state is finished. The props to
 * end state will be reported back.
 * @category Hook
 */
export function useNested<EndStatePropT = any>(
  startingCondition: boolean,
  stateFunc: StateFunc<undefined>
): NestedState<EndStatePropT>;
/**
 * Add a nested state to state machine when `stateConfigProvider` returns a
 * non-null {@linkcode StateConfig}. Nested state will be cancelled if parent
 * state transitions away.
 * @param stateConfigProvider A function that returns either a
 * {@linkcode StateConfig} or undefined. If a valid `StateConfig` is returned,
 * the nested state will start.
 * @typeparam EndStatePropT Type of the props to be passed to end state.
 * Transitioning to end state means the nested state is finished. The props to
 * end state will be reported back.
 * @category Hook
 */
export function useNested<EndStatePropT = any>(
  stateConfigProvider: () => StateConfig<any> | undefined
): NestedState<EndStatePropT>;
export function useNested(
  startingConditionOrStateConfigProvider:
    | boolean
    | (() => StateConfig<any> | undefined),
  stateFunc?: StateFunc<any>,
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
  if (queueItem.chainId !== undefined) {
    // Nested state is already added. We check if it is ended.
    const state = machine.getStateByChainId(queueItem.chainId);
    if (state && isEndState(state)) {
      return [true, state.config.props];
    }
    return nestedStateNotDone;
  }

  // nested state hasn't started yet.

  if (typeof startingConditionOrStateConfigProvider === "function") {
    const maybeStateConfig = startingConditionOrStateConfigProvider();
    if (maybeStateConfig == undefined) {
      return nestedStateNotStarted;
    }
    // we can start the nested state
    const state = State.builder()
      .machine(machine)
      .config(maybeStateConfig)
      .id(machine.genChainId())
      .parent(processingState)
      .build();
    machine.addState(state);

    return nestedStateNotDone;
  }
  // startingConditionOrStateConfigProvider is a boolean
  if (!startingConditionOrStateConfigProvider) {
    // cannot start yet
    return nestedStateNotStarted;
  }
  // start nested state
  // nested state will run after the current state.
  const state = State.builder()
    .machine(machine)
    .config(newState(stateFunc!, typeof props === "function" ? props() : props))
    .id(machine.genChainId())
    .parent(processingState)
    .build();
  machine.addState(state);

  queueItem.chainId = state.chainId;
  return nestedStateNotDone;
}

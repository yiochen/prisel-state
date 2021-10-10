export interface StateConfig<PropT = undefined> {
  stateFunc: StateFunc<PropT>;
  props: PropT;
}

const END_STATE_FUNC: StateFunc<any> = () => {
  useSideEffect(() => {
    const currentState = machine.getProcessingState();
    // if there is an parent state, mark it as dirty, so that next iteration
    // will run and detect that child is ended.
    currentState?.parentState?.markDirty();
  }, []);
};

export type StateFuncReturn = StateConfig<any> | void;
export type StateFunc<PropT = void> = PropT extends void
  ? () => StateFuncReturn
  : (props: PropT) => StateFuncReturn;

interface StateMachine {
  genChainId(): string;
  getProcessingState(): State | undefined;
  schedule(): void;
  addStateFromConfig(newStateConfig: StateConfig<any>, chainId?: string): State;
  sendAll(event: string, eventData?: any): void;
  sendAllForId(chainId: string, event: string, eventData?: any): void;
  getStateByChainId(id: string): State | undefined;
}

/**
 * Object return by `run(stateFunc)`. Inspector can be used to send event to state
 */
export interface Inspector {
  /**
   * Send event to the states in the same chain as the starting state
   */
  send: (event: string, eventData?: any) => void;
  /**
   * Send event to all active states in the state machine.
   */
  sendAll: (event: string, eventData?: any) => void;
}

interface Hook {
  type: HookType;
}

enum HookType {
  LOCAL_STATE,
  EFFECT,
  EVENT,
  NESTED_STATE,
}

type Dispatch<A> = (value: A) => void;
type SetStateAction<S> = S | ((prevState: S) => S);
type SetLocalState<T> = Dispatch<SetStateAction<T>>;

interface LocalStateHook<T> extends Hook {
  type: HookType.LOCAL_STATE;
  value: T | undefined;
  setLocalState: SetLocalState<T>;
}

type EffectFunc = () => (() => void) | void;

interface EffectHook extends Hook {
  type: HookType.EFFECT;
  effectFunc: EffectFunc | undefined;
  cleanupFunc: (() => unknown) | undefined;
  deps: any[] | undefined;
}

interface EventHook extends Hook {
  type: HookType.EVENT;
  eventName: string;
  eventData: any;
  eventTriggered: boolean;
}

interface NestedStateHook extends Hook {
  type: HookType.NESTED_STATE;
  chainId: string | undefined; // chainId undefined means nested state hasn't started.
}

interface HookMap {
  [HookType.EFFECT]: EffectHook;
  [HookType.LOCAL_STATE]: LocalStateHook<any>;
  [HookType.EVENT]: EventHook;
  [HookType.NESTED_STATE]: NestedStateHook;
}

const machine: StateMachine = (() => {
  class MachineImpl implements StateMachine {
    allocatedStateId = 0;
    currentProcessingState: string = "";
    states: Map<string, State> = new Map();
    scheduled: Promise<void> | undefined;

    addStateFromConfig(
      newStateConfig: StateConfig<any>,
      chainId?: string
    ): State {
      const stateKey = chainId ? chainId : this.genChainId();
      const state = new State(this, newStateConfig, stateKey);
      this.states.set(stateKey, state);
      return state;
    }

    /**
     * Run all current dirty states. Dirty states include new states and state
     * changed via setLocalState.
     * This function needs to be called constantly to make sure the dirty states
     * are processed. For example, it can be called every 100 ms, or called
     * every time a network message is received.
     */
    run() {
      this.scheduled = undefined;
      // run all dirty states
      this.states.forEach((state, chainId) => {
        const shouldRun = state.isDirty();
        const parentStateTransitioned =
          state.parentState &&
          state.parentState !==
            this.getStateByChainId(state.parentState.chainId);
        let shouldCleanup = parentStateTransitioned;
        let shouldDelete = parentStateTransitioned;
        let nextStateConfig: StateConfig<any> | void = undefined;
        if (shouldRun) {
          this.currentProcessingState = chainId;
          nextStateConfig = state.run();
          if (nextStateConfig != undefined) {
            shouldDelete = true;
            shouldCleanup = true;
          }
        }
        if (shouldCleanup) {
          state.cleanup();
        }
        if (shouldDelete) {
          state.markInactive();
          this.states.delete(chainId);
        }
        if (nextStateConfig && !parentStateTransitioned) {
          const newState = this.addStateFromConfig(nextStateConfig, chainId); // new state will be run in this iteration too.
          newState.parentState = state.parentState;
        }
      });
    }

    genChainId() {
      this.allocatedStateId++;
      return "state-" + this.allocatedStateId;
    }
    getProcessingState() {
      return this.states.get(this.currentProcessingState);
    }

    schedule() {
      if (this.scheduled) {
        return;
      } else {
        this.scheduled = Promise.resolve();
        this.scheduled.then(this.run.bind(this));
      }
    }

    sendAll(event: string, eventData: any) {
      // find all state with corresponding event hook. Store the event data
      // and mark the state as dirty.
      for (const [, state] of this.states) {
        if (state.maybeTriggerEvent(event, eventData)) {
          this.schedule();
        }
      }
    }

    sendAllForId(chainId: string, event: string, eventData: any) {
      for (const [, state] of this.states) {
        if (
          (state.chainId === chainId || state.isDescendantOf(chainId)) &&
          state.maybeTriggerEvent(event, eventData)
        ) {
          this.schedule();
        }
      }
    }

    getStateByChainId(id: string) {
      return this.states.get(id);
    }
  }
  return new MachineImpl();
})();

function isEventHook(hook: Hook): hook is EventHook {
  return hook.type === HookType.EVENT;
}

class State {
  config: StateConfig<any>;
  /**
   * State are identified by chainId. chainId is inherited by new state when the
   * current state transitioned to the new state. At any given time, the active
   * states in state machine all have unique chainId. ChainId is used to
   * identifie the nested state chain to see if it is ended. For more, see `useNested`.
   */
  chainId: string;
  parentState: State | undefined;
  private queue: Hook[] = [];
  private currentId = -1;
  private machine: StateMachine;
  private dirty = true;
  private active = true;
  constructor(
    machine: StateMachine,
    config: StateConfig<any>,
    stateKey: string,
    parentState?: State
  ) {
    this.machine = machine;
    this.chainId = stateKey;
    this.config = config;
    this.parentState = parentState;
  }
  isHookAdded() {
    return this.queue[this.currentId] != undefined;
  }
  setHook(hook: Hook) {
    this.queue[this.currentId] = hook;
  }
  incrementHookId() {
    this.currentId++;
  }
  getHook<T extends HookType>(hookType: T): HookMap[T] {
    if (this.queue[this.currentId] == undefined) {
      // something went wrong. This might be caused by hooks being used in
      // conditions or loops
      // https://reactjs.org/docs/hooks-rules.html#only-call-hooks-at-the-top-level
      throw new Error(
        "trying to access hooks that doesn't exist. This might be caused by hooks used inside conditionals or loops"
      );
    }
    if (this.queue[this.currentId].type !== hookType) {
      throw new Error(
        "trying to access hook but got mismatched hook type. This might be caused by hooks used inside conditionals or loops"
      );
    }
    return this.queue[this.currentId] as HookMap[T];
  }
  maybeTriggerEvent(event: string, eventData: any) {
    let eventTriggered = false;
    for (const hook of this.queue) {
      if (isEventHook(hook) && hook.eventName === event) {
        eventTriggered = true;
        this.markDirty();
        hook.eventData = eventData;
        hook.eventTriggered = true;
      }
    }

    return eventTriggered;
  }
  run() {
    this.currentId = -1;
    this.dirty = false;
    const transitionConfig = this.config.stateFunc(this.config.props);
    if (this.dirty) {
      // setLocalState is called inside stateFunc. This is not recommended. We
      // simply ignore instead of triggering another call to stateFunc to
      // prevent infinite loop.
      console.warn(
        "setLocalState called inside state function will not trigger a rerun"
      );
    }
    // run all effectFuncs
    for (const hook of this.queue) {
      if (isHook(hook, HookType.EFFECT) && hook.effectFunc != undefined) {
        const cleanupFunc = hook.effectFunc();
        if (typeof cleanupFunc === "function") {
          hook.cleanupFunc = cleanupFunc;
        }
        hook.effectFunc = undefined;
      }
    }

    return transitionConfig;
  }
  /**
   * Cleanup the state before state is removed. This includes running all cleanup
   * functions of effect hooks
   */
  cleanup() {
    for (const hook of this.queue) {
      if (isHook(hook, HookType.EFFECT) && hook.cleanupFunc != undefined) {
        hook.cleanupFunc();
        hook.cleanupFunc = undefined;
      }
    }
  }
  markInactive() {
    this.active = false;
  }
  isActive() {
    return this.active;
  }
  isDirty() {
    return this.dirty;
  }
  markDirty() {
    this.dirty = true;
    this.machine.schedule();
  }
  isDescendantOf(chainId: string) {
    let parent = this.parentState;
    while (parent) {
      if (parent.chainId === chainId) {
        return true;
      }
      parent = parent.parentState;
    }
    return false;
  }
}

function isHook<T extends HookType>(
  hook: Hook,
  hookType: T
): hook is HookMap[T] {
  return hook.type === hookType;
}

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

type AllDeps = undefined;
const AllDeps = undefined;
/**
 * Compare dependency arrays.
 * @param oldDeps
 * @param newDeps
 * @returns true if dependencies are considered equal
 */
function unchangedDeps(oldDeps: any[] | AllDeps, newDeps: any[] | AllDeps) {
  if (oldDeps === AllDeps || newDeps === AllDeps) {
    // if any of the dependencies are undefined. That means whole closure
    // is considered as dependency. Every call to state func will trigger
    // execution of the hook.
    return false;
  }
  if (newDeps.length != oldDeps.length) {
    return false;
  }
  return oldDeps.every((value, index) => Object.is(value, newDeps[index]));
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

export function useEvent<EventDataT = undefined>(
  eventName: string
): [boolean, EventDataT | undefined] {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useState outside of state machine scope");
  }
  processingState.incrementHookId();
  if (!processingState.isHookAdded()) {
    const newQueueItem: EventHook = {
      type: HookType.EVENT,
      eventName,
      eventData: undefined,
      eventTriggered: false,
    };
    processingState.setHook(newQueueItem);
  }

  const eventHook = processingState.getHook(HookType.EVENT);
  // If eventName changed, we will start listening for new event in next turn.
  // For current turn, we will still return event for current event.
  eventHook.eventName = eventName;
  if (eventHook.eventTriggered) {
    eventHook.eventTriggered = false;
    const eventData = eventHook.eventData;
    eventHook.eventData = undefined;
    return [true, eventData];
  }
  return [false, undefined];
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
 * @param stateFunc nested state function. If state function is a variable,
 * @param props props to the nested state function
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
    const state = machine.addStateFromConfig(newState(stateFunc, props));
    state.parentState = processingState;
    queueItem.chainId = state.chainId;
    return nestedStateNotDone;
  }
  // Nested state is already added. We check if it is ended.
  const state = machine.getStateByChainId(queueItem.chainId);
  if (state && state.config.stateFunc === END_STATE_FUNC) {
    return [true, state.config.props];
  }
  return nestedStateNotDone;
}

export function newState<PropT>(
  nextState: StateFunc<PropT>,
  props: PropT
): StateConfig<PropT>;
export function newState<PropT = undefined>(
  newState: StateFunc<PropT>
): StateConfig<undefined>;
export function newState(nextState: StateFunc<any>, props?: any) {
  return {
    stateFunc: nextState,
    props,
  };
}

export function endState<PropT>(props: PropT): StateConfig<PropT>;
export function endState(): StateConfig<undefined>;
export function endState(props?: any) {
  return { stateFunc: END_STATE_FUNC, props };
}

const sendAll = machine.sendAll.bind(machine);
const sendAllForId = machine.sendAllForId.bind(machine);
/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state
 */
export function run<PropT>(state: StateFunc<PropT>, prop: PropT): Inspector;
export function run<PropT = undefined>(state: StateFunc<PropT>): Inspector;
export function run(state: StateFunc<any>, props?: any) {
  const { chainId } = machine.addStateFromConfig(newState(state, props));
  machine.schedule();
  return {
    send(event: string, eventData: any) {
      sendAllForId(chainId, event, eventData);
    },
    sendAll,
  };
}

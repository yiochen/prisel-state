export interface StateConfig<PropT = undefined> {
  stateFunc: StateFunc<PropT>;
  props: PropT;
}

const END_STATE_FUNC = () => {};

export type StateFunc<PropT = void> = (
  props?: PropT
) => StateConfig<any> | void;

interface StateMachine {
  genStateId(): string;
  getProcessingState(): State | undefined;
  schedule(): void;
}

/**
 * Object return by `run(stateFunc)`. Inspector can be used to inspect the
 * current state of state machine
 */
export interface Inspector {
  states: () => StateConfig<any>[];
  send: (event: string, eventData?: any) => void;
}

interface Hook {
  type: HookType;
}

enum HookType {
  LOCAL_STATE,
  EFFECT,
  EVENT,
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

interface HookMap {
  [HookType.EFFECT]: EffectHook;
  [HookType.LOCAL_STATE]: LocalStateHook<any>;
  [HookType.EVENT]: EventHook;
}

class MachineImpl implements StateMachine {
  allocatedStateId = 0;
  currentProcessingState: string = "";
  states: Map<string, State> = new Map();
  scheduled: Promise<void> | undefined;

  addStateFromConfig(newStateConfig: StateConfig<any>) {
    const stateKey = this.genStateId();
    this.states.set(stateKey, new State(this, newStateConfig));
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
    this.states.forEach((state, stateKey) => {
      if (state.dirty) {
        this.currentProcessingState = stateKey;
        const newStateConfig = state.run();
        if (newStateConfig !== undefined) {
          state.markInactive();
          this.addStateFromConfig(newStateConfig); // new state will be run in this iteration too.
          this.states.delete(stateKey);
        }
      }
    });
  }

  genStateId() {
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

  getInspector(): Inspector {
    return {
      states: () =>
        Array.from(this.states.values()).map((state) => state.config),
      send: (event: string, eventData?: any) => {
        // find all state with corresponding event hook. Store the event data
        // and mark the state as dirty.
        for (const [, state] of this.states) {
          if (state.maybeTriggerEvent(event, eventData)) {
            this.schedule();
          }
        }
      },
    };
  }
}

const machine = new MachineImpl();
const inspector = machine.getInspector();

function isEventHook(hook: Hook): hook is EventHook {
  return hook.type === HookType.EVENT;
}

class State {
  queue: Hook[] = [];
  currentId = -1;
  config: StateConfig<any>;
  id: string;
  machine: StateMachine;
  dirty = true;
  active = true;
  constructor(machine: StateMachine, config: StateConfig<any>) {
    this.machine = machine;
    this.id = machine.genStateId();
    this.config = config;
  }
  isNextAdded() {
    return this.queue[this.currentId + 1] != undefined;
  }
  setNext(value: any) {
    this.currentId++;
    this.queue[this.currentId] = value;
  }
  getNext<T extends HookType>(hookType: T): HookMap[T] {
    this.currentId++;
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
    if (transitionConfig !== undefined) {
      // we need to transition to next state.
      // we will go through all useSideEffect hooks and call all cleanup functions.
      for (const hook of this.queue) {
        if (isHook(hook, HookType.EFFECT) && hook.cleanupFunc != undefined) {
          hook.cleanupFunc();
          hook.cleanupFunc = undefined;
        }
      }
    }
    return transitionConfig;
  }
  markInactive() {
    this.active = false;
  }
  isActive() {
    return this.active;
  }
  markDirty() {
    this.dirty = true;
    this.machine.schedule();
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

  if (processingState.isNextAdded()) {
    const queueItem: LocalStateHook<any> = processingState.getNext(
      HookType.LOCAL_STATE
    );
    // not first time running this hook. Simply ignore the given value,
    // instead, return the original value.
    return [queueItem.value, queueItem.setLocalState];
  }
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
  processingState.setNext(newQueueItem);

  return [newQueueItem.value, newQueueItem.setLocalState];
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
  if (processingState.isNextAdded()) {
    const queueItem: EffectHook = processingState.getNext(HookType.EFFECT);
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
  // new hook
  const newQueueItem: EffectHook = {
    type: HookType.EFFECT,
    effectFunc: effectFunc,
    cleanupFunc: undefined, // cleanup func might be populated when effectFunc is run after the state func.
    deps,
  };
  processingState.setNext(newQueueItem);
}

export function useEvent<EventDataT = undefined>(
  eventName: string
): [boolean, EventDataT | undefined] {
  const processingState = machine.getProcessingState();
  if (!processingState) {
    throw new Error("Cannot useState outside of state machine scope");
  }
  if (processingState.isNextAdded()) {
    const eventHook = processingState.getNext(HookType.EVENT);
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
  } else {
    const newQueueItem: EventHook = {
      type: HookType.EVENT,
      eventName,
      eventData: undefined,
      eventTriggered: false,
    };
    processingState.setNext(newQueueItem);
  }
  return [false, undefined];
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

/**
 * Start the state machine with the given initial state. If the state machine is
 * already started. The state will be run in parallel of the other state.
 * @param state
 */
export function run<PropT>(state: StateFunc<PropT>, prop: PropT): Inspector;
export function run<PropT = undefined>(state: StateFunc<PropT>): Inspector;
export function run(state: StateFunc<any>, props?: any) {
  machine.addStateFromConfig(newState(state, props));
  machine.schedule();
  return inspector;
}

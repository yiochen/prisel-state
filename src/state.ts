import type { AmbientRef, AmbientValueRef } from "./ambient";
import { isEndState } from "./endState";
import type { EventRef } from "./event";
import type { Hook } from "./hook";
import { HookType } from "./hook";
import type { HookMap } from "./hookMap";
import { isHook } from "./hookMap";
import type { StateDebugInfo } from "./inspector";
import { run } from "./run";
import type { StateMachine } from "./stateMachine";
import { assertNonNull, ImmutableMapBuilder, isGenerator } from "./utils";

/**
 * Returned type of state function. If a state function is normal function, the
 * returned type is `StateConfig<any> | void`. If a state function is a
 * generator, the returned type is an iterator.
 */
export type StateFuncReturn =
  | StateConfig<any>
  | void
  | Generator<StateConfig<any>, StateConfig<any>, void>;

/**
 * A function describing a state. A `StateFunc` takes props and return a
 * {@linkcode StateConfig} for the next state to transition to.
 */
export type StateFunc<PropT = undefined> = PropT extends undefined
  ? () => StateFuncReturn
  : (props: PropT) => StateFuncReturn;

/**
 * A wrapper object containing the {@linkcode StateFunc} and the props to be
 * passed to the `StateFunc`.
 */
export interface StateConfig<PropT = undefined> {
  stateFunc: StateFunc<PropT>;
  props: PropT;
  /** @internal */
  ambient: ImmutableMapBuilder<AmbientRef<any>, AmbientValueRef<any>>;
  label: string | null;
  setLabel(label: string): StateConfig<PropT>;
}

export function createStateConfig<PropT = undefined>(
  stateFunc: StateFunc<PropT>,
  props: PropT,
  ambient: ImmutableMapBuilder<AmbientRef<any>, AmbientValueRef<any>>
): StateConfig<PropT> {
  const stateConfig: StateConfig<PropT> = {
    stateFunc,
    props,
    ambient,
    label: null,
    setLabel: (label: string) => {
      stateConfig.label = label;
      return stateConfig;
    },
  };
  return stateConfig;
}

export class StateBuilder {
  private _machine?: StateMachine;
  private _config?: StateConfig<any>;
  private _id?: string;
  private _ambientState: State | null = null;
  machine(machine: StateMachine) {
    this._machine = machine;
    return this;
  }
  config(config: StateConfig<any>) {
    this._config = config;
    return this;
  }
  id(chainId: string) {
    this._id = chainId;
    return this;
  }
  ambientState(state: State) {
    this._ambientState = state;
    return this;
  }

  build(): State {
    return new State(
      assertNonNull(this._machine, "machine"),
      assertNonNull(this._config, "config"),
      assertNonNull(this._id, "id"),
      this._ambientState
    );
  }
}

const INITIAL_HOOK_ID = -1;
export class State {
  /**
   * State are identified by chainId. chainId is inherited by new state when the
   * current state transitioned to the new state. At any given time, the active
   * states in state machine all have unique chainId. ChainId is used to
   * identifie the nested state chain to see if it is ended. For more, see `useNested`.
   */
  chainId: string;
  stateFunc: StateFunc<any>;
  props: any;
  label: string | null;
  ambient: ImmutableMapBuilder<AmbientRef<any>, AmbientValueRef<any>>;
  private queue: Hook[] = [];
  private currentId = INITIAL_HOOK_ID;
  private machine: StateMachine;
  private dirty = true;
  private active = true;
  private recordedHookId: number | null = null;
  /**
   * We don't know if an state is a generator state until the first time we run it.
   */
  private isGeneratorState: boolean | null = null;
  private gen: Generator<StateConfig<any>, StateConfig<any>, void> | null =
    null;
  constructor(
    machine: StateMachine,
    config: StateConfig<any>,
    stateKey: string,
    ambientState: State | null
  ) {
    this.machine = machine;
    this.chainId = stateKey;
    this.stateFunc = config.stateFunc;
    this.props = config.props;
    this.label = config.label;
    this.ambient = ambientState
      ? config.ambient.setParent(ambientState.ambient)
      : config.ambient;
  }

  static builder() {
    return new StateBuilder();
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
  /**
   * At the end of state func call, check if the hookId is incremented to the
   * same number comparing to previous run.
   * If this is the first run, record the hook id and return true. Otherwise
   * return false.
   * @returns whether the hookId is incremented to the same as last run
   */
  recordOrCompareHookId(): boolean {
    if (this.recordedHookId === null) {
      this.recordedHookId = this.currentId;
    }
    return this.recordedHookId === this.currentId;
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
  maybeTriggerEvent(event: EventRef, eventData: any) {
    let eventTriggered = false;
    for (const hook of this.queue) {
      if (isHook(hook, HookType.EVENT) && hook.event.ref === event) {
        const [matched, data] = hook.event.process(eventData);
        eventTriggered = eventTriggered || matched;
        if (matched) {
          hook.eventData = data;
          hook.eventTriggered = true;
        }
      }
    }
    if (eventTriggered) {
      this.markDirty();
    }

    return eventTriggered;
  }

  processHookFunc(
    transitionConfig: StateConfig<any> | void
  ): StateConfig<any> | void {
    if (this.dirty) {
      // setLocalState is called inside stateFunc. This is not recommended. We
      // simply ignore instead of triggering another call to stateFunc to
      // prevent infinite loop.
      console.warn(
        "SetLocalState called inside state function will not trigger a rerun"
      );
    }
    if (!this.recordOrCompareHookId()) {
      console.warn(
        "Detected inconsistent hooks compared to last call to this state function. Please follow hook's rule to make sure same hooks are run for each call."
      );
    }
    return transitionConfig;
  }

  processGenerator(): StateConfig<any> | void {
    if (!this.gen) {
      throw new Error("Gen should not be null");
    }
    const { done, value: nextState } = this.gen.next();
    if (this.currentId != INITIAL_HOOK_ID) {
      // the generator state uses hook, this is forbidden. Generator state
      // shouldn't be rerun due to event or local state etc.
      throw new Error(
        "Detected hook usage in generator state. Generator state cannot use hooks"
      );
    }

    if (done) {
      return nextState;
    }
    if (isEndState(nextState)) {
      // the generator yielded an endState, we will treat this as the end of
      // the state chain, even if there might be follow-on in the generator.
      return nextState;
    }
    // we have a nested state to run.
    const inspector = run(nextState);
    inspector.onComplete(() => {
      // when nested state completes, we need to
      this.markDirty();
    });
    return;
  }

  run() {
    this.currentId = INITIAL_HOOK_ID;
    this.dirty = false;

    if (this.isGeneratorState === null) {
      const transitionConfigOrGenerator = this.stateFunc(this.props);
      this.isGeneratorState = isGenerator(transitionConfigOrGenerator);
      if (isGenerator(transitionConfigOrGenerator)) {
        this.isGeneratorState = true;
        this.gen = transitionConfigOrGenerator;
        return this.processGenerator();
      }
      this.isGeneratorState = false;
      return this.processHookFunc(transitionConfigOrGenerator);
    }

    if (this.isGeneratorState) {
      return this.processGenerator();
    }
    return this.processHookFunc(this.stateFunc(this.props) as any);
  }

  runEffects() {
    // run all effectFuncs
    for (const hook of this.queue) {
      if (isHook(hook, HookType.EFFECT) && hook.effectFunc != undefined) {
        const cleanupFunc = hook.effectFunc();
        if (typeof cleanupFunc === "function") {
          // cleanupFunc will be called in useSideEffect or when cleanup
          hook.cleanupFunc = cleanupFunc;
        }
        hook.effectFunc = undefined;
      }
    }
  }
  /**
   * Cleanup the state before state is removed. This includes running all cleanup
   * functions of effect hooks
   */
  runCleanup() {
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
  getDebugInfo(): StateDebugInfo {
    const info: StateDebugInfo = {
      chainId: this.chainId,
      dirty: this.isDirty(),
      props: this.props,
    };
    if (this.recordedHookId !== null) {
      info.hookCount = this.recordedHookId + 1;
    }
    if (this.label !== null) {
      info.label = this.label;
    }
    return info;
  }
}

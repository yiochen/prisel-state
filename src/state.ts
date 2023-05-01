import type { AmbientRef, AmbientValueRef } from "./ambient";
import { isEndState } from "./endState";
import { AssertionError, HookNotFoundError } from "./errors";
import type { EventRef } from "./event";
import type { Hook } from "./hook";
import { HookType } from "./hook";
import type { HookMap } from "./hookMap";
import { isHook } from "./hookMap";
import { ImmutableMapBuilder } from "./immutableMap";
import type { StateDebugInfo } from "./inspector";
import { onCleanup } from "./onCleanup";
import { run } from "./run";
import type { StateConfig, StateFunc } from "./stateConfig";
import { StateLifecycle } from "./stateLifecycle";
import type { StateMachine } from "./stateMachine";
import { assertNonNull, isGenerator } from "./utils";

export class StateBuilder {
  private _machine?: StateMachine;
  private _config?: StateConfig<any>;
  private _id?: string;
  private _ambientState: State | null = null;
  private _parent: State | null = null;
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
  parent(state: State) {
    this._parent = state;
    return this;
  }

  build(): State {
    return new State(
      assertNonNull(this._machine, "machine"),
      assertNonNull(this._config, "config"),
      assertNonNull(this._id, "id"),
      this._ambientState,
      this._parent
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
  label: string;
  ambient: ImmutableMapBuilder<AmbientRef<any>, AmbientValueRef<any>>;
  private parent: State | null;
  private queue: Hook[] = [];
  private currentId = INITIAL_HOOK_ID;
  private machine: StateMachine;
  private dirty = true;
  private recordedHookId: number | null = null;
  /**
   * We don't know if an state is a generator state until the first time we run it.
   */
  private isGeneratorState: boolean | null = null;
  private gen: Generator<StateConfig<any>, StateConfig<any>, void> | null =
    null;
  /**
   * Cleanups to run right after running the state function. Those cleanups
   * are due to dep change in useEffect.
   */
  private pendingCleanup: Array<() => unknown> = [];
  /**
   * Cleanups for the generator function. Those cleanups are run only when the
   * generator state is canceled, or when it transitions.
   */
  private generatorCleanup: Array<() => unknown> = [];

  /**
   * Children is not inherited to next state. A state should wait for all
   * children state to resolve to avoid memory leak. If a child needs to run
   * even when parent transitions, then it's better to create a grandparent
   * wrapping the parent, and lift child to be the same level as parent.
   */
  private children = new Set<State>();
  /**
   * State is being canceled
   */
  private isCanceling = false;
  /**
   * State should be canceled, but current lifecycle is not interruptable, so we
   * will wait until the end of current lifecycle and change to CANCELING lifecycle.
   */
  pendingCancel = false;
  nextState: StateConfig<any> | undefined;
  lifecycle = StateLifecycle.IDLE;

  constructor(
    machine: StateMachine,
    config: StateConfig<any>,
    stateKey: string,
    ambientState: State | null,
    parent: State | null
  ) {
    this.machine = machine;
    this.chainId = stateKey;
    this.stateFunc = config.stateFunc;
    this.props = config.props;
    this.label = config.label || config.stateFunc.name || "anonymous state";
    this.ambient = ambientState
      ? config.ambient.setParent(ambientState.ambient)
      : config.ambient;
    this.parent = parent;
    if (parent) {
      parent.addChild(this);
    }
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
      throw new HookNotFoundError(
        hookType,
        "Trying to access hooks that doesn't exist. This might be caused by hooks used inside conditionals or loops"
      );
    }
    if (this.queue[this.currentId].type !== hookType) {
      throw new HookNotFoundError(
        hookType,
        "Trying to access hook but got mismatched hook type. This might be caused by hooks used inside conditionals or loops"
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
      // TODO: check lifecycle to see if it is still active.
      this.markDirty();
    }

    return eventTriggered;
  }

  validateHookFuncReturn(
    transitionConfig: StateConfig<any> | void
  ): StateConfig<any> | undefined {
    if (this.dirty) {
      // setLocalState or eventEmitter is called inside stateFunc. This is not recommended. We
      // simply ignore instead of triggering another call to stateFunc to
      // prevent infinite loop.
      console.warn(
        "Side effects triggered inside state function (such as setting local state, sending event) will not trigger a rerun of current state function. Make sure to call them inside useEffect"
      );
    }
    if (!this.recordOrCompareHookId()) {
      console.warn(
        "Detected inconsistent hooks compared to last call to this state function. Please follow hook's rule to make sure same hooks are run for each call."
      );
    }
    if (!transitionConfig) {
      return;
    }
    return transitionConfig;
  }

  processGenerator(): StateConfig<any> | undefined {
    if (!this.gen) {
      throw new AssertionError("Internal error: Gen should not be null");
    }
    const { done, value: nextState } = this.gen.next();
    if (this.currentId != INITIAL_HOOK_ID) {
      // This generator state uses hook, which is forbidden. Generator state
      // shouldn't be rerun due to event or local state etc.
      throw new AssertionError(
        "Detected hook usage in generator state. Generator state cannot use hooks"
      );
    }

    if (this.pendingCancel) {
      return;
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
      // when nested state completes, we need to continue
      this.markDirty();
    });
    return;
  }

  addChild(child: State) {
    this.children.add(child);
  }

  runState(initialState = StateLifecycle.RUNNING) {
    if (this.lifecycle === StateLifecycle.IDLE) {
      this.lifecycle = initialState;
    }

    while (
      !(
        this.lifecycle === StateLifecycle.ENDED ||
        this.lifecycle === StateLifecycle.IDLE
      )
    ) {
      switch (this.lifecycle) {
        case StateLifecycle.RUNNING: {
          this.lifecycle = this.runStateFunc();
          continue;
        }
        case StateLifecycle.SIDE_EFFECT: {
          this.runEffects();
          this.lifecycle = this.pendingCancel
            ? StateLifecycle.CANCELING
            : StateLifecycle.IDLE;
          continue;
        }
        case StateLifecycle.CLEANING_UP: {
          // run generator cleanup
          for (const cleanup of this.generatorCleanup) {
            cleanup();
          }
          this.generatorCleanup = [];

          // we will treat all sideEffects as dirty and run their cleanup
          // functions too.
          for (const hook of this.queue) {
            if (
              isHook(hook, HookType.EFFECT) &&
              hook.cleanupFunc != undefined
            ) {
              hook.cleanupFunc();
              hook.cleanupFunc = undefined;
            }
          }
          if (this.isCanceling || this.nextState) {
            this.lifecycle = StateLifecycle.ENDED;
            continue;
          }
          if (this.pendingCancel) {
            this.lifecycle = StateLifecycle.CANCELING;
            continue;
          }
          throw new Error("unreachable state");
        }
        case StateLifecycle.TRANSITIONING: {
          this.cancelChildren();
          this.lifecycle = this.pendingCancel
            ? StateLifecycle.CANCELING
            : StateLifecycle.CLEANING_UP;
          continue;
        }
        case StateLifecycle.CANCELING: {
          this.isCanceling = true;
          this.cancelChildren();
          this.lifecycle = StateLifecycle.CLEANING_UP;
          continue;
        }
      }
    }
    if (this.lifecycle === StateLifecycle.ENDED) {
      this.machine.removeState(this);
    }
  }

  /**
   * Add cleanup function to run when current generator state is canceled or completed
   * @param callback Callback to call when canceling current generator state
   */
  public addGeneratorCleanup(callback: () => unknown) {
    if (!this.isGeneratorState) {
      throw new AssertionError(
        "onCleanup can only be called for generator state function. Try using useEffect to add cleanup logic.",
        onCleanup
      );
    }
    this.generatorCleanup.push(callback);
  }

  public addCleanup(callback: () => unknown) {
    this.pendingCleanup.push(callback);
  }

  public cancel() {
    if (this.pendingCancel) {
      return;
    }
    this.pendingCancel = true;
    this.nextState = undefined;
    if (this.lifecycle === StateLifecycle.IDLE) {
      // if current state is idle, manually run the lifecycle transition instead
      // of waiting it to be dirty.
      this.runState(StateLifecycle.CANCELING);
    }
  }

  private cancelChildren() {
    for (const child of this.children) {
      child.cancel();
    }
  }

  private runStateFunc() {
    this.currentId = INITIAL_HOOK_ID;
    this.dirty = false;
    if (this.isGeneratorState === null) {
      const transitionConfigOrGenerator = this.stateFunc(this.props);
      const isGeneratorState = isGenerator(transitionConfigOrGenerator);
      this.isGeneratorState = isGeneratorState;
      if (isGeneratorState) {
        this.gen = transitionConfigOrGenerator;
        const nextState = this.processGenerator();
        if (this.pendingCancel) {
          return StateLifecycle.CANCELING;
        }
        this.nextState = nextState;
        return nextState
          ? StateLifecycle.TRANSITIONING
          : StateLifecycle.SIDE_EFFECT;
      }
      const nextState = this.validateHookFuncReturn(
        transitionConfigOrGenerator
      );
      this.runPendingCleanup();
      if (this.pendingCancel) {
        return StateLifecycle.CANCELING;
      }
      this.nextState = nextState;
      return nextState
        ? StateLifecycle.TRANSITIONING
        : StateLifecycle.SIDE_EFFECT;
    }

    const nextState = this.isGeneratorState
      ? this.processGenerator()
      : this.validateHookFuncReturn(this.stateFunc(this.props) as any);
    this.runPendingCleanup();
    if (this.pendingCancel) {
      return StateLifecycle.CANCELING;
    }
    this.nextState = nextState;
    return nextState
      ? StateLifecycle.TRANSITIONING
      : StateLifecycle.SIDE_EFFECT;
  }

  /**
   * After running state function, we want to run any previous cleanup function
   * of useEffect hook. We know a hook requires cleanup if the hook has both
   * the effectFunc (which means it has new effect to run later) and cleanupFunc
   */
  private runPendingCleanup() {
    for (const cleanup of this.pendingCleanup) {
      cleanup();
    }
    this.pendingCleanup = [];
  }

  runEffects() {
    // run all effectFuncs
    for (const hook of this.queue) {
      if (isHook(hook, HookType.EFFECT) && hook.effectFunc != undefined) {
        const cleanupFunc = hook.effectFunc();
        if (typeof cleanupFunc === "function") {
          // cleanupFunc will be called in useEffect or when cleanup
          hook.cleanupFunc = cleanupFunc;
        }
        hook.effectFunc = undefined;
        if (this.pendingCancel) {
          return;
        }
      }
    }
  }

  isDirty() {
    return this.dirty;
  }
  markDirty() {
    this.dirty = true;
    this.machine.schedule();
  }
  private getStack() {
    const stack: string[] = [];
    let current: State | null = this;
    while (current) {
      stack.push(current.label);
      current = current.parent;
    }
    return stack;
  }
  getDebugInfo(): StateDebugInfo {
    const info: StateDebugInfo = {
      chainId: this.chainId,
      dirty: this.isDirty(),
      props: this.props,
      stack: this.getStack(),
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

import { Hook, HookType } from "./hook";
import { HookMap, isHook } from "./hookMap";
import { createInspectorForId, Inspector } from "./inspector";
import { StateMachine } from "./stateMachine";
import { assertNonNull } from "./utils";

export type StateFuncReturn = StateConfig<any> | void;
export type StateFunc<PropT = void> = PropT extends void
  ? () => StateFuncReturn
  : (props: PropT) => StateFuncReturn;

export interface StateConfig<PropT = undefined> {
  stateFunc: StateFunc<PropT>;
  props: PropT;
}

export class StateBuilder {
  private _machine?: StateMachine;
  private _config?: StateConfig<any>;
  private _id?: string;
  private _inspector?: Inspector;
  private _parent?: State;
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
  inspector(inspector: Inspector) {
    this._inspector = inspector;
    return this;
  }
  parent(parent: State | undefined) {
    this._parent = parent;
    return this;
  }

  build(): State {
    return new State(
      assertNonNull(this._machine, "machine"),
      assertNonNull(this._config, "config"),
      assertNonNull(this._id, "id"),
      this._inspector ?? createInspectorForId(assertNonNull(this._id, "id")),
      this._parent
    );
  }
}

export class State {
  config: StateConfig<any>;
  /**
   * State are identified by chainId. chainId is inherited by new state when the
   * current state transitioned to the new state. At any given time, the active
   * states in state machine all have unique chainId. ChainId is used to
   * identifie the nested state chain to see if it is ended. For more, see `useNested`.
   */
  chainId: string;
  parentState: State | undefined;
  inspector: Inspector;
  private queue: Hook[] = [];
  private currentId = -1;
  private machine: StateMachine;
  private dirty = true;
  private active = true;
  private recordedHookId: number | null = null;
  constructor(
    machine: StateMachine,
    config: StateConfig<any>,
    stateKey: string,
    inspector: Inspector,
    parentState?: State
  ) {
    this.machine = machine;
    this.chainId = stateKey;
    this.config = config;
    this.inspector = inspector;
    this.parentState = parentState;
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
  maybeTriggerEvent(event: string, eventData: any) {
    let eventTriggered = false;
    for (const hook of this.queue) {
      if (isHook(hook, HookType.EVENT) && hook.eventName === event) {
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
        "SetLocalState called inside state function will not trigger a rerun"
      );
    }
    if (!this.recordOrCompareHookId()) {
      console.warn(
        "Detected inconsistent hooks compared to last call to this state function. Please follow hook's rule to make sure same hooks are run for each call."
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
  debugString() {
    return `state["${this.chainId}"](dirty: ${this.isDirty()}, parent: ${
      this.parentState?.chainId ?? null
    }, hookCount: ${
      this.recordedHookId === null ? "unknown" : this.recordedHookId + 1
    }, props: ${this.config.props})`;
  }
}

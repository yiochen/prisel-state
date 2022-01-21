import { Ambient } from "./ambient";
import { AmbientNotFoundError, AssertionError } from "./errors";
import type { Emitter, Event } from "./event";
import { EventManager } from "./eventManager";
import { getAmbient, hasAmbient } from "./getAmbient";
import { MultiMap } from "./multiMap";
import type { StateConfig } from "./state";
import { State } from "./state";

const MAX_MICRO_QUEUE_CALLS = 100;
export interface StateMachine {
  genChainId(): string;
  getProcessingState(): State | undefined;
  schedule(): void;
  send(eventEmitter: Emitter<any>, eventData?: any): void;
  runWithState<T = void>(chainId: string, callback: () => T): T;
  addState(state: State): void;
  getStateByChainId(id: string): State | undefined;
  subscribe(event: Event<any>): void;
  getAmbientForCurrentState<AmbientT>(
    ambient: Ambient<AmbientT>,
    defaultValue?: AmbientT
  ): AmbientT;
  hasAmbient(ambient: Ambient<any>): boolean;
  /**
   * Mark a state for closure. When a active state is closed, the cleanup function of
   * side effect will run.
   */
  closeState(chainId: string): void;
  /**
   * Add callback to be trigger when the state chain reaches endState. The added
   * callback will be called in endState.
   * @param chainId
   * @param callback
   */
  addOnComplete(chainId: string, callback: () => unknown): void;
  /**
   * For endState to run and remove the recorded callbacks.
   * @param chainId
   */
  runOnCompletes(chainId: string): void;
}

export class MachineImpl implements StateMachine {
  allocatedStateId = 0;
  currentProcessingState: string = "";
  states: Map<string, State> = new Map();
  scheduled: Promise<void> | undefined;
  microQueueCalledTimes = 0;
  eventManager = EventManager.create();
  pendingDeleted = new Set<string>();
  onCompleteCallbacks = new MultiMap<string, () => unknown>();

  addState(state: State) {
    this.states.set(state.chainId, state);
    state.ambient.build();
    this.schedule();
  }

  send(eventEmitter: Emitter<any>, eventData?: any) {
    if (this.eventManager.send(eventEmitter, eventData)) {
      this.schedule();
    }
  }

  runWithState<T = void>(chainId: string, callback: () => T): T {
    const previous = this.currentProcessingState;
    this.currentProcessingState = chainId;
    const returned = callback();
    this.currentProcessingState = previous;
    return returned;
  }

  /**
   * Run all current dirty states. Dirty states include new states and state
   * changed via setLocalState.
   * This function needs to be called constantly to make sure the dirty states
   * are processed. For example, it can be called every 100 ms, or called
   * every time a network message is received.
   */
  run = () => {
    this.scheduled = undefined;
    const dirtyStates = new Set<State>();
    for (const [_, state] of this.states) {
      if (state.isDirty()) {
        dirtyStates.add(state);
      }
    }
    const transitioningStates = new Map<State, StateConfig<any>>();

    // run state func
    for (const state of dirtyStates) {
      const nextStateConfig = this.runWithState(state.chainId, () =>
        state.run()
      );
      if (nextStateConfig) {
        transitioningStates.set(state, nextStateConfig);
      }
    }

    // run effect and cleanup
    for (const state of dirtyStates) {
      this.runWithState(state.chainId, () => state.runEffects());
    }

    // handle transition
    for (const [transitioningState, nextStateConfig] of transitioningStates) {
      this.runWithState(transitioningState.chainId, () => {
        transitioningState.runCleanup();
      });
      const chainId = transitioningState.chainId;
      this.removeState(transitioningState);
      this.addState(
        State.builder()
          .machine(this)
          .config(nextStateConfig)
          .id(chainId)
          .ambientState(transitioningState)
          .build()
      );
    }

    // State is marked for deletion when it reaches end state, or when
    // inspector.exit() is called (usually by parent state before it transitions).
    for (const pendingDeleteId of this.pendingDeleted) {
      const deletedState = this.states.get(pendingDeleteId);
      if (deletedState != undefined) {
        this.runWithState(pendingDeleteId, () => deletedState.runCleanup());
        this.removeState(deletedState);
      }
    }
  };

  subscribe(event: Event<any>) {
    const currentState = this.getProcessingState();
    if (currentState) {
      this.eventManager.subscribe(event, currentState);
    } else {
      console.warn(
        "useEvent called outside of state function. This has no effect."
      );
    }
  }

  genChainId() {
    do {
      this.allocatedStateId++;
    } while (this.states.has(`state-` + this.allocatedStateId));
    return "state-" + this.allocatedStateId;
  }

  getProcessingState() {
    return this.states.get(this.currentProcessingState);
  }

  schedule() {
    if (this.scheduled) {
      return;
    } else {
      this.microQueueCalledTimes++;
      if (this.microQueueCalledTimes > MAX_MICRO_QUEUE_CALLS) {
        throw new AssertionError(
          "Maximum calls to schedule. Make sure you don't schedule repeatively."
        );
      }
      this.scheduled = Promise.resolve();
      this.scheduled.then(this.run);
      setTimeout(() => {
        this.microQueueCalledTimes = 0;
      });
    }
  }

  removeState(state: State) {
    if (state.isActive()) {
      state.markInactive();
      this.eventManager.unsubscribe(state);
      this.states.delete(state.chainId);
    }
  }

  getStateByChainId(id: string) {
    return this.states.get(id);
  }

  getAmbientForCurrentState<AmbientT>(
    ambient: Ambient<AmbientT>,
    defaultValue?: AmbientT
  ): AmbientT;
  getAmbientForCurrentState<AmbientT>(
    ambient: Ambient<AmbientT>,
    ...defaultValue: AmbientT[]
  ) {
    const processingState = this.getProcessingState();
    if (!processingState) {
      throw new AmbientNotFoundError(
        ambient,
        getAmbient,
        "Cannot get ambient outside of state function"
      );
    }

    const ambientMap = processingState.ambient.build();
    if (ambientMap.has(ambient.ref)) {
      return ambientMap.get(ambient.ref)!.value;
    }
    if (defaultValue.length > 0) {
      return defaultValue[0];
    }
    throw new AmbientNotFoundError(ambient);
  }

  hasAmbient(ambient: Ambient<any>) {
    const processingState = this.getProcessingState();
    if (!processingState) {
      throw new AmbientNotFoundError(
        ambient,
        hasAmbient,
        "Cannot get ambient outside of state function"
      );
    }
    const ambientMap = processingState.ambient.build();
    return ambientMap.has(ambient.ref);
  }

  closeState(chainId: string) {
    this.pendingDeleted.add(chainId);
    this.onCompleteCallbacks.delete(chainId);
    this.schedule();
  }

  addOnComplete(chainId: string, callback: () => unknown) {
    this.onCompleteCallbacks.add(chainId, callback);
  }

  runOnCompletes(chainId: string) {
    const callbacks = this.onCompleteCallbacks.get(chainId);
    for (const callback of callbacks) {
      callback();
    }
  }
}

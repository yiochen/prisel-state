import { Ambient } from "./ambient";
import { AmbientManager } from "./ambientManager";
import type { Emitter, Event } from "./event";
import { EventManager } from "./eventManager";
import type { StateDebugInfo } from "./inspector";
import type { StateConfig } from "./state";
import { State } from "./state";

const MAX_MICRO_QUEUE_CALLS = 100;
export interface StateMachine {
  genChainId(): string;
  getProcessingState(): State | undefined;
  schedule(): void;
  send(eventEmitter: Emitter<any>, eventData?: any): void;
  addState(state: State, prevState?: State): void;
  getStateByChainId(id: string): State | undefined;
  debugStates(): StateDebugInfo[];
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
}

export class MachineImpl implements StateMachine {
  allocatedStateId = 0;
  currentProcessingState: string = "";
  states: Map<string, State> = new Map();
  scheduled: Promise<void> | undefined;
  microQueueCalledTimes = 0;
  eventManager = EventManager.create();
  ambientManager = AmbientManager.create();
  pendingDeleted = new Set<string>();

  addState(state: State, prevState?: State) {
    this.states.set(state.chainId, state);
    this.ambientManager.storeWrappedAmbient(state, prevState);
    this.schedule();
  }

  send(eventEmitter: Emitter<any>, eventData?: any) {
    if (this.eventManager.send(eventEmitter, eventData)) {
      this.schedule();
    }
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
      this.currentProcessingState = state.chainId;
      const nextStateConfig = state.run();
      if (nextStateConfig) {
        transitioningStates.set(state, nextStateConfig);
      }
    }

    // run effect and cleanup
    for (const state of dirtyStates) {
      this.currentProcessingState = state.chainId;
      state.runEffects();
    }

    // handle transition
    for (const [transitioningState, nextStateConfig] of transitioningStates) {
      this.currentProcessingState = transitioningState.chainId;
      transitioningState.runCleanup();
      const chainId = transitioningState.chainId;
      this.removeState(transitioningState);
      this.addState(
        State.builder()
          .machine(this)
          .config(nextStateConfig)
          .id(chainId)
          .build(),
        transitioningState
      );
    }

    // State is marked for deletion when it reaches end state, or when
    // inspector.exit() is called (usually by parent state before it transitions).
    for (const pendingDeleteId of this.pendingDeleted) {
      const deletedState = this.states.get(pendingDeleteId);
      if (deletedState != undefined) {
        deletedState.runCleanup();
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
        throw new Error(
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
    if (
      defaultValue.length === 0 ||
      this.ambientManager.hasAmbient(this.currentProcessingState, ambient.ref)
    ) {
      return this.ambientManager.getAmbient(
        this.currentProcessingState,
        ambient.ref
      );
    }
    return defaultValue[0];
  }

  hasAmbient(ambient: Ambient<any>) {
    return this.ambientManager.hasAmbient(
      this.currentProcessingState,
      ambient.ref
    );
  }

  debugStates = () => {
    return Array.from(this.states.values()).map((state) =>
      state.getDebugInfo()
    );
  };
  closeState(chainId: string) {
    this.pendingDeleted.add(chainId);
    this.schedule();
  }
}

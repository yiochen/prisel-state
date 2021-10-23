import type { Emitter, Event } from "./event";
import { EventManager } from "./eventManager";
import type { Inspector } from "./inspector";
import type { StateConfig } from "./state";
import { State } from "./state";

export interface StateMachine {
  genChainId(): string;
  getProcessingState(): State | undefined;
  schedule(): void;
  send(eventEmitter: Emitter<any>, eventData?: any): void;
  addState(state: State): void;
  getInspector(): Inspector;
  getStateByChainId(id: string): State | undefined;
  removeState(state: State): void;
  debugStates(): void;
  subscribe(event: Event<any>): void;
}

export class MachineImpl implements StateMachine {
  allocatedStateId = 0;
  currentProcessingState: string = "";
  states: Map<string, State> = new Map();
  scheduled: Promise<void> | undefined;
  eventManager = EventManager.create();
  inspector: Inspector = {
    debugStates: () => this.debugStates(),
  };

  addState(state: State) {
    this.states.set(state.chainId, state);
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
  run() {
    this.scheduled = undefined;
    // run all dirty states
    this.states.forEach((state, chainId) => {
      const shouldRun = state.isDirty();
      const parentStateTransitioned =
        state.parentState &&
        state.parentState !== this.getStateByChainId(state.parentState.chainId);
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
        this.eventManager.unsubscribe(state);
        this.states.delete(chainId);
      }
      if (nextStateConfig && !parentStateTransitioned) {
        const newState = State.builder()
          .machine(this)
          .config(nextStateConfig)
          .id(chainId) // new state will be run in this iteration too.
          .parent(state.parentState)
          .build();
        this.addState(newState);
      }
    });
  }

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
      this.scheduled = Promise.resolve();
      this.scheduled.then(this.run.bind(this));
    }
  }

  getInspector() {
    return this.inspector;
  }

  removeState(state: State) {
    state.markInactive();
    this.states.delete(state.chainId);
  }

  getStateByChainId(id: string) {
    return this.states.get(id);
  }
  debugStates() {
    const debugStrings = Array.from(this.states.values()).map((state) =>
      state.debugString()
    );
    console.log(
      `==== Debug states start ====
  ${debugStrings.join("\n")}
  ==== Debug states end ====`
    );
  }
}

import type { StateConfig } from "./state";
import { State } from "./state";

export interface StateMachine {
  genChainId(): string;
  getProcessingState(): State | undefined;
  schedule(): void;
  addState(state: State): void;
  sendAll(event: string, eventData?: any): void;
  sendAllForId(chainId: string, event: string, eventData?: any): void;
  getStateByChainId(id: string): State | undefined;
  removeState(state: State): void;
  debugStates(): void;
}

export class MachineImpl implements StateMachine {
  allocatedStateId = 0;
  currentProcessingState: string = "";
  states: Map<string, State> = new Map();
  scheduled: Promise<void> | undefined;

  addState(state: State) {
    this.states.set(state.chainId, state);
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
        this.states.delete(chainId);
      }
      if (nextStateConfig && !parentStateTransitioned) {
        const newState = State.builder()
          .machine(this)
          .config(nextStateConfig)
          .id(chainId) // new state will be run in this iteration too.
          .inspector(state.inspector)
          .parent(state.parentState)
          .build();
        this.addState(newState);
      }
    });
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

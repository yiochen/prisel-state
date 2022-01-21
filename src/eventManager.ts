import type { Emitter, Event, EventRef } from "./event";
import { machine } from "./machine";
import { State } from "./state";

export class EventManager {
  private eventToStateMap: Map<EventRef, Set<State>> = new Map();
  private stateToEventMap: WeakMap<State, Set<EventRef>> = new WeakMap();

  public static create() {
    return new EventManager();
  }

  public subscribe(event: Event<any>, state: State) {
    const stateSet = this.getStateSet(event.ref);
    stateSet.add(state);
    const eventSet = this.getEventSet(state);
    eventSet.add(event.ref);
  }

  public unsubscribe(state: State) {
    const eventSet = this.getEventSet(state);
    for (const event of eventSet) {
      this.getStateSet(event).delete(state);
    }
    this.stateToEventMap.delete(state);
  }

  public send(event: Emitter<any>, data: any) {
    const stateSet = this.getStateSet(event.ref);
    let needToSchedule = false;
    for (const state of stateSet) {
      const triggered = machine.runWithState(state.chainId, () =>
        state.maybeTriggerEvent(event.ref, data)
      );
      needToSchedule = needToSchedule || triggered;
    }
    return needToSchedule;
  }

  private getStateSet(eventRef: EventRef) {
    if (!this.eventToStateMap.has(eventRef)) {
      this.eventToStateMap.set(eventRef, new Set<State>());
    }
    return this.eventToStateMap.get(eventRef)!;
  }

  private getEventSet(state: State) {
    if (!this.stateToEventMap.has(state)) {
      this.stateToEventMap.set(state, new Set());
    }
    return this.stateToEventMap.get(state)!;
  }
}

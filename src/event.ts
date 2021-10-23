import { State } from "./state";

/**
 * An object wrapping the event name to be used as a identifier of an event.
 */
export interface EventRef {
  name: string;
}

/**
 * Object to be passed to {@linkcode Inspector.send} to denote the event to send.
 * @typeparam EventDataT The type of the event data.
 */
export interface Emitter<EventDataT> {
  ref: EventRef;
}

export type Filter = {
  type: "filter";
  predicate: (data: any) => boolean;
};

export type Transformer = {
  type: "map";
  transform: (data: any) => any;
};

/**
 * A typed event that includes the name of the event and the data type of the
 * event data.
 */
export interface Event<EventDataT> {
  name: string;
  ref: EventRef;
  /**
   * Create a new `Event` that only gets triggered when the predicate returns true.
   * @param predicate A function that takes the event data and return `true`/`false`.
   * @returns A new `Event`
   */
  filter(predicate: (value: EventDataT) => boolean): Event<EventDataT>;
  /**
   * Create a new `Event` that transforms the event data when the event is triggered.
   * @param transform A function that transforms event data.
   * @typeparam NewEventDataT The data type of the new `Event`.
   * @returns A new `Event.
   */
  map<NewEventDataT>(
    transform: (value: EventDataT) => NewEventDataT
  ): Event<NewEventDataT>;
}

export class EventImpl<EventDataT> implements Event<EventDataT> {
  name: string;
  ref: EventRef;
  processors: Array<Filter | Transformer>;

  constructor(
    eventName: string,
    processors: Array<Filter | Transformer> = [],
    ref = { name: eventName }
  ) {
    this.name = eventName;
    this.ref = ref;
    this.processors = processors;
  }

  filter(predicate: (value: EventDataT) => boolean) {
    return new EventImpl<any>(
      this.name,
      [...this.processors, { type: "filter", predicate }],
      this.ref
    );
  }

  map(transform: (value: EventDataT) => any) {
    return new EventImpl<any>(
      this.name,
      [...this.processors, { type: "map", transform }],
      this.ref
    );
  }

  process(eventData: any): [boolean, any] {
    let current = eventData;
    for (const processor of this.processors) {
      if (processor.type === "filter" && !processor.predicate(current)) {
        return [false, undefined];
      }
      if (processor.type === "map") {
        current = processor.transform(current);
      }
    }
    return [true, current];
  }
}

/**
 * Create an typed event. This function returns two object, an {@linkcode Event}
 * and an {@linkcode Emitter}. `Event` is used for subscribing to an event.
 * `Emitter` is used to dispatch an event.
 * @param eventName The name of the event.
 * @typeparam EventDataT The data type of the event data.
 * @returns A tuple containing {@linkcode Event} and {@linkcode Emitter}
 * @see {@link useEvent}, {@link Inspector.send}
 */
export function newEvent<EventDataT = undefined>(
  eventName: string
): [Event<EventDataT>, Emitter<EventDataT>] {
  const event = new EventImpl<EventDataT>(eventName);
  return [event, { ref: event.ref }];
}

export class EventManager {
  private eventToStateMap: Map<EventRef, Set<State>> = new Map();
  private stateToEventMap: WeakMap<State, Set<EventRef>> = new WeakMap();
  private eventDataMap: Map<EventRef, any> = new Map();

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
      needToSchedule =
        needToSchedule || state.maybeTriggerEvent(event.ref, data);
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

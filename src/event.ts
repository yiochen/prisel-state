import { machine } from "./machine";

/**
 * An object wrapping the event name to be used as a identifier of an event.
 */
export interface EventRef {
  name: string;
}

/**
 * An object for sending event.
 * @typeparam EventDataT The type of the event data.
 */
export interface Emitter<EventDataT> {
  ref: EventRef;
  send: EventDataT extends undefined ? () => void : (data: EventDataT) => void;
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
 * @see {@link useEvent}
 */
export function newEvent<EventDataT = undefined>(
  eventName: string
): [Event<EventDataT>, Emitter<EventDataT>] {
  const event = new EventImpl<EventDataT>(eventName);
  const emitter = {
    ref: event.ref,
    send: ((eventData?: any) => {
      machine.send(emitter, eventData);
    }) as Emitter<EventDataT>["send"],
  };
  return [event, emitter];
}

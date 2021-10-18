export interface EventRef {
  name: string;
}

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

export interface Event<EventDataT> {
  name: string;
  ref: EventRef;
  filter(predicate: (value: EventDataT) => boolean): Event<EventDataT>;
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

export function newEvent<EventDataT = undefined>(
  eventName: string
): [Event<EventDataT>, Emitter<EventDataT>] {
  const event = new EventImpl<EventDataT>(eventName);
  return [event, { ref: event.ref }];
}

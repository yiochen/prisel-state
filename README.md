# @prisel/state

[![npm
version](https://badge.fury.io/js/@prisel%2Fstate.svg)](https://badge.fury.io/js/@prisel%2Fstate)

Declarative and decentralized state machine inspired by React.

## Get Started

Install the library from npm

```
npm i @prisel/state
```

## Guide

### State Function

Each state in `@prisel/state` is defined as a function. A state function is a
declarative way to define the state's property, local states, side effects,
events and transitions. A state function can usually be structured in the
following way:

```ts
function MyState(): StateFuncReturn {
  // Defines local state, side effects and events
  // Defines transitions
}
```

A very important attribute of state function is that, it is pure. Calling a
state function repeatedly should not have different results. The impure part of
the state (side effect, event subscription) are handled outside of the state
function by the state machine.

State functions are recommended to be named using `UpperCamelCase` to
differentiate from normal functions. They should ideally use adjetives that
describe the state, for example `GameStarted`, `UserLoggedIn`, unless we have
very clear name of each state, like `Child`, `Teenager`, `MidAge`, `Elder`.

# Defining State Function

A simplest state is just a noop function, like below:

```ts
function Liquid() {}
```

State function can take a prop to initialize. A prop can be any type.

```ts
function Liquid(liquidType: string) {}
```

To set this state as the initial state and run the state machine, import `run`, and pass the state function to it.

```ts
import { run } from "@prisel/state";

run(Liquid);
// or if Liquid takes a prop
run(Liquid, "water");
```

### Local State

Each state can have internal state. This is useful to model numeric states which
are hard to convert to individual state function. For example, we
can have a temperature state.

```ts
import { useState, run, StateFuncReturn } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useState(/* initial temperature */ 0);

  console.log(temperature); // prints 0
}

run(Liquid);
```

Calling `setTemperature` with a different temperature will cause the `liquid`
function to be run again in the next tick.

### Side Effect

A state that does no side effect is not interesting. Let's add some side effect.

Similar to React's effect hook, `@prisel/state` has a `useEffect` hook that can be
used to perform side effect.

```ts
useEffect(callback, deps);
```

For example:

```ts
import { useEffect, run, StateFuncReturn } from "@prisel/state";

function Liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useState(0);
  useEffect(() => {
    // this will be run after the boiling state function is run.
    const intervalId = setInterval(() => {
      setTemperature((oldTemp) => oldTemp + 10);
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  }, []); // an empty dependencies array means side effect will be run only once when entering this state

  useEffect(() => {
    console.log(temperature); // will print 0, 10, 20, 30 ...
  }); // when dependencies argument is not specified, side effect will be run every time this state runs
}

run(Liquid);
```

### Event

Event is an important concept in a state machine. Event can cause the state to
change, or trigger side effect. With events, state machine can finally "move".

Events in `@prisel/state` are defined outside of state function.

```ts
import { newEvent } from "@prisel/state";

const [event, emitter] = newEvent("myEvent");
```

`newEvent` returns two objects, an `Event` and an `Emitter`. `Event` is used to
subscribe to a event. `Emitter` is used to dispatch an event. `newEvent` takes a
string for the event name. Event name is only for documentation and debugging
purpose. If `newEvent` is called twice with the same event name, two different events will
be created.

To define an event that expects an event data, specify the type of the event
data.

```ts
const [event, emitter] = newEvent<number>("myNumEvent");
```

#### Create extended event

We can create new event that originates from an event using `fitler` or `map`.

```ts
// filters the event by event data. If false is returned, the event will not trigger.
const filteredEvent = event.filter((eventData) => true);

// transform the event data.
const transformedEvent = event.map((eventData) => "" + eventData);
```

Events created from `filter` or `map` shares the same `Event.ref`. They can be
invoke using the same `Emitter`.

#### Subscribe to event

Subscribing to an event is done using `useEvent` hook.

```ts
const eventResult = useEvent(event);
```

`useEvent` takes an `Event` to subscribe to and returns an `EventResult`, which
is a nullable wrapper for the event data. If event is triggered, `eventResult`
will contain the event data. Otherwise `eventResult` will be `undefined`.

```ts
import { run, newState, StateFuncReturn } from "@prisel/state";

const [heat, emitHeat] = newEvent<number>("heat");

function Liquid(): StateFuncReturn {
  const heated = useEvent(heat);
  useEffect(() => {
    if (heated) {
      console.log(`heated up ${heated.value} degree`);
    }
  });
}
```

#### Dispatch an event

To send an event subscribers, use `Emitter` returned from `newEvent`.

```ts
const [boil, emitBoil] = newEvent<number>("boil");

function Liquid(): StateFuncReturn {
  const boiled = useEvent(boil);
  if (boiled) {
    return newState(vapor, time);
  }
}

function Vapor(timeToBoil: number) {
  console.log(`vaporized in ${timeToBoil} seconds`);
}

run(Liquid);
emitBoil.send(10);
```

### Transition

To transition to new state, return a new state configuration from the function.
A state configuration can be constructed using `newState(stateFunc, props)`
function.

```ts
import { useEffect, run, newState, StateFuncReturn } from "@prisel/state";

function State1(): StateFunReturn {
  const [done, setDone] = useState(false);
  useEffect(() => {
    console.log("state 1");
    const timeoutId = setTimeout(() => {
      setDone(true);
    }, 1000); // transition after 1 second
    return () => clearTimeout(timeoutId);
  }, []);

  if (done) {
    return newState(State2);
  }
}

function State2(): StateFuncReturn {}

run(State1);
```

### Nested state

State transititons are useful to describe a series of actions to be performed in
sequence. Within a state, we can also start nested states. Starting a nested
state is no different from starting a normal state. We will call `run` to start
a nested state. Starting a new state is a side effect, so we should call it
inside `onSideEffect`. A nested state is consider a child state of the current
state. State machine keeps track of the current state being processed. If a
nested state is `run` inside a state's side effect or cleanup function, then it is
consider a child of that state.

#### Cancel nested state when parent state transitions

Nested state are automatically canceled when the parent state cancels or
transitions. Cancelation work in a post-order traversal fashion. This means, the
cancelation logic for a child state will run first, before the cancelation logic
for a parent state. Cancelation will run the cleanup function returned in
`useEffect` if the side effect has been run.

To manually cancel a nested state, we can call the `exit` function on the
`Inspector` returned from `run`. `Inspector#exit` will cancel the current active
state originated from the state passed to `run`. So if a nested state
transitioned to another state, we can still cancel it.

```ts
function Child() {}

function Parent() {
  useEffect(() => {
    const inspector = run(Child);
    const timeoutId = setTimeout(() => {
      inspector.exit();
    }, 1000); // cancel Child after 1 second

    return () => {
      clearTimeout(timeoutId);
      // if parent is canceled, we don't need to worry about canceling Child because it will be automatically canceled.
    };
  }, []);
}
```

### Get a callback when nested state reaches an end state

We often use nested state to process a side task and want to be notified when
the side task is finished. We can do so by passing a callback to nested state,
and makes sure the nested state passes the callback to new states when it
transitions. The convention is to pass an object with a `onEnd` function as
prop. We can also pass an `onEnd` callback to `endState`.

```ts
function Child(props: { onEnd: () => void }) {
  const [shouldEnd, setShouldEnd] = useState(false);
  useEffect(() => {
    setTimeout(() => setShouldEnd(true), 1000); // transition after 1 second
  });

  if (shouldEnd) {
    return endState({ onEnd: props.onEnd }); // pass the onEnd callback to end state
  }
}

function Parent() {
  const [childEnded, setChildEnded] = useState(false);
  useEffect(() => {
    run(Child, { onEnd: () => setChildEnded(true) });
  }, []);
}
```

### Store nested state inspector

Sometimes we want to get hold of the `Inspector` returned from `run`, we can
store it either using `useState` or `useRef`. `useRef` will not cause
the state function to run again when the value changes and we can always get the
latest value from `current` field.

```ts
function Child() {}

function Parent() {
  const inspectorRef = useRef<Inspector | null>(null);
  useEffect(() => {
    inspectorRef.current = run(Child);
  }, []);
}
```

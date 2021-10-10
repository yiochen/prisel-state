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

Each state in @prisel/state is defined as a function. A simplest state is just a noop
function, like below:

```typescript
function liquid() {}
```

State function can take a prop to initialize. A prop can be any type.

```typescript
function liquid(liquidType: string) {
  console.log("type of the liquid is " + liquidType);
}
```

To set this state as the initial state and run the state machine, import `run`, and pass the state function to it.

```typescript
import { run } from "@prisel/state";

run(liquid);
// or with props
run(liquid, "water");
```

Each state can have internal state. This is useful to model numeric states which
are hard and cumbersome to convert to individual state function. For example, we
can have a temperature state.

```typescript
import { useLocalState, run, StateFuncReturn } from "@prisel/state";

function liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(
    /* initial temperature */ 0
  );

  console.log(temperature); // prints 0
}

run(liquid);
```

Calling `setTemperature` with a different temperature will cause the `liquid`
function to be run again.

A state that does no side effect is not interesting. Let's add some side effect.

Similar to React's effect hook, @prisel/state has a `useSideEffect` hook that can be
used to perform side effect.

```typescript
useSideEffect(callback, deps);
```

For example:

```typescript
import { useSideEffect, run, StateFuncReturn } from "@prisel/state";

function liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(0);
  useSideEffect(() => {
    // this will be run after the boiling state function is run.
    const intervalId = setInterval(() => {
      setTemperature((oldTemp) => oldTemp + 10);
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  }); // an empty dependencies array means side effect will be run only once when entering this state

  console.log(temperature); // will print 0, 10, 20, 30 ...
}

run(liquid);
```

To transition to new state, return a new state configuration from the function.
A state configuration can be constructed using `newState(stateFunc, props)`
function.

```typescript
import { useSideEffect, run, newState, StateFuncReturn } from "@prisel/state";

function liquid(): StateFuncReturn {
  const [temperature, setTemperature] = useLocalState(0);
  useSideEffect(() => {
    // this will be run after the boiling state function is run.
    const intervalId = setInterval(() => {
      setTemperature((oldTemp) => oldTemp + 10);
    }, 100);
    return () => {
      clearInterval(intervalId);
    };
  }, []); // an empty dependencies array means side effect will be run only once when entering this state

  if (temperature >= 100) {
    return newState(vapor);
  }
}

function vapor() {
  console.log("vaporized!");
}

run(liquid);
```

State can also receive events. A event is a string name and any associated data.
To subscribe to an event, use `useEvent`.

```typescript
const [triggered, eventData] = useEvent(eventName);
```

`useEvent` takes a string event name to subscribe to this event. When the event
is triggered, the state function will be called and useEvent will return `[true, eventData]`. If state function is called for other reasons (e.g.
`setLocalState`), `useEvent` will return `[false, undefined]`.

```typescript
import { run, newState, StateFuncReturn } from "@prisel/state";

function liquid(): StateFuncReturn {
  const [boiled, time] = useEvent<number>("boil");
  // typescript wasn't able to infer time is defined if we destructure the
  // tuple before narrowing down the tuple type
  if (boiled && time != undefined) {
    return newState(vapor, time);
  }
}

function vapor(timeToBoil: number) {
  console.log(`vaporized in ${timeToBoil} seconds`);
}
```

To send an event to a currently running state, use the inspector returned from
`run`

```typescript
function liquid(): StateFuncReturn {
  const [boiled, time] = useEvent<number>("boil");
  if (boiled && time != undefined) {
    return newState(vapor, time);
  }
}

function vapor(timeToBoil: number) {
  console.log(`vaporized in ${timeToBoil} seconds`);
}

const inspector = run(liquid);
inspector.send("boil", 10);
```

State transititons are useful to describe a series of actions to be performed in
sequence. Within a state, we can also start nested states. comparing to normal
state, nested states have the following properties:

1. Nested states and parent state coexists. Starting a nested state won't replace
   the current state.
1. Nested states will be cancelled when parent state transitions to other state.
1. When a nested state transitions to end state, the parent state will get
   notified and receives results.

```typescript
function parent(): StateFuncReturn {
  useSideEffect(() => {
    console.log("parent started");
  }, []);
  const [startChild] = useEvent("start-child");
  const [childDone, result] = useNested(startChild, child);
  if (childDone) {
    console.log("parent ended because " + result);
    return endState();
  }
}
function child(): StateFuncReturn {
  useSideEffect(() => {
    console.log("child started");
  }, []);
  const [finishChild] = useEvent("finish-child");
  if (finishChild) {
    const childMessage = "child ended";
    console.log("child ended by event");
    return endState(childMessage);
  }
}

const inspector = run(parent);
setTimeout(() => {
  inspector.send("start-child");
}, 0);
setTimeout(() => {
  inspector.send("finish-child");
}, 0);

// prints
// parent started
// child started
// child ended by event
// parent ended because child ended
```

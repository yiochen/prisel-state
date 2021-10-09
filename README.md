# @prisel/state

[![npm
version](https://badge.fury.io/js/@prisel%2Fstate.svg)](https://badge.fury.io/js/@prisel%2Fstate)

Declarative and decentralized state machine inspired by React.

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
import { useLocalState, run, StateConfig } from "@prisel/state";

function liquid(): StateConfig | void {
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
import { useSideEffect, run, StateConfig } from "@prisel/state";

function liquid(): StateConfig | void {
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
import { useSideEffect, run, newState, StateConfig } from "@prisel/state";

function liquid(): StateConfig | void {
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
import { run, newState, StateConfig } from "@prisel/state";

function liquid(): StateConfig<number> | void {
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
function liquid(): StateConfig<number> | void {
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

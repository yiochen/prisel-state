import {
  endState,
  Inspector,
  newEvent,
  newState,
  run,
  StateFuncReturn,
  useEvent,
  useLocalState,
  useSideEffect,
  useStored,
} from "../../index";

function runSteps(...calls: Function[]) {
  for (const call of calls) {
    setTimeout(call, 10);
  }
}

() => {
  // basic state function
  function Liquid() {}
};

() => {
  // state function with prop
  function Liquid(liquidType: string) {
    console.log("tyoe of the liquid is " + liquidType);
  }
};

() => {
  // run
  function Liquid() {}
  run().id("basic state").start(Liquid);
};

() => {
  // run with props
  function Liquid(liquidType: string) {}
  run().id("basic state with prop").start(Liquid, "water");
};

() => {
  // useLocalState
  function Liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useLocalState(
      /* initial temperature */ 0
    );

    console.log(temperature);
  }
  run().id("state with localState").start(Liquid);
};

(() => {
  // useSideEffect
  function Liquid(): StateFuncReturn {
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

    if (temperature >= 100) {
      return endState();
    }
  }

  run().id("state with end state").start(Liquid);
})();

(() => {
  // transition to newState
  function Liquid(): StateFuncReturn {
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
      return newState(Vapor);
    }
  }

  function Vapor() {
    console.log("vaporized!");
  }

  run().id("state with transition").start(Liquid);
})();

(() => {
  // useEvent
  const [boiled] = newEvent<number>("boil");

  function Liquid(): StateFuncReturn {
    const boiledResult = useEvent(boiled);
    if (boiledResult) {
      return newState(Vapor, boiledResult.value);
    }
  }

  function Vapor(timeToBoil: number): StateFuncReturn {
    console.log(`vaporized in ${timeToBoil} seconds`);
  }
  run().id("state with event").start(Liquid);
})();

(() => {
  // send event outside
  const [boiled, boilEmitter] = newEvent<number>("boil");

  function Liquid(): StateFuncReturn {
    const boiledResult = useEvent(boiled);
    if (boiledResult) {
      return newState(Vapor, boiledResult.value);
    }
  }

  function Vapor(timeToBoil: number): StateFuncReturn {
    console.log(`vaporized in ${timeToBoil} seconds`);
  }

  run().id("state with externally dispatched event").start(Liquid);
  boilEmitter.send(100);
})();

(() => {
  // send event inside state function

  const [boiled, boilEmitter] = newEvent<number>("boil");
  const [vaporized, vaporizeEmitter] = newEvent("vaporized");

  function Liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useLocalState(0);
    const boiledResult = useEvent(boiled);
    useSideEffect(() => {
      if (boiledResult) {
        setTemperature((oldTemperature) => oldTemperature + boiledResult.value);
      }
      if (temperature >= 100) {
        vaporizeEmitter.send();
      }
    });

    if (temperature >= 100) {
      return endState();
    }
  }

  function HeaterActive(): StateFuncReturn {
    const vaporizedResult = useEvent(vaporized);
    useSideEffect(() => {
      const intervalId = setInterval(() => {
        boilEmitter.send(10);
      }, 100);
      return () => {
        clearInterval(intervalId);
      };
    });
    if (vaporizedResult) {
      return endState();
    }
  }

  run(Liquid);
  run(HeaterActive);
})();

(() => {
  // useNested

  function Child() {}

  function Parent() {
    useSideEffect(() => {
      const inspector = run(Child);
      return inspector.exit; // return a clean up function which remove the child state when parent transitions.
    }, []);
  }
})();

(() => {
  function Child(props: { onEnd: () => void }) {
    const [shouldEnd, setShouldEnd] = useLocalState(false);
    useSideEffect(() => {
      setTimeout(() => setShouldEnd(true), 1000); // transition after 1 second
    });

    if (shouldEnd) {
      return endState({ onEnd: props.onEnd }); // pass the onEnd callback to end state
    }
  }

  function Parent() {
    const [childEnded, setChildEnded] = useLocalState(false);
    useSideEffect(() => {
      run(Child, { onEnd: () => setChildEnded(true) });
    }, []);
  }

  run(Parent);
})();

(() => {
  function Child() {}

  function Parent() {
    const inspectorRef = useStored<Inspector | null>(null);
    useSideEffect(() => {
      inspectorRef.current = run(Child);
    }, []);
  }

  run(Parent);
})();

export default {};

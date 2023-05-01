import {
  endState,
  Inspector,
  newEvent,
  newState,
  run,
  StateFuncReturn,
  useEffect,
  useEvent,
  useRef,
  useState,
} from "../../src/index";

() => {
  // basic state function
  function Liquid() {}
  run(Liquid);
};

() => {
  // state function with prop
  function Liquid(liquidType: string) {
    console.log("tyoe of the liquid is " + liquidType);
  }
  run(Liquid, "water");
};

() => {
  // run
  function Liquid() {}
  run(newState(Liquid).setLabel("basic state"));
};

() => {
  // run with props
  function Liquid(liquidType: string) {
    console.log("tyoe of the liquid is " + liquidType);
  }
  run(newState(Liquid, "water").setLabel("basic state with prop"));
};

() => {
  // useState
  function Liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useState(/* initial temperature */ 0);
    useEffect(() => {
      setTemperature(2);
    }, []);

    console.log(temperature);
  }
  run(newState(Liquid).setLabel("state with localState"));
};

(() => {
  // useEffect
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
    }); // an empty dependencies array means side effect will be run only once when entering this state

    console.log(temperature); // will print 0, 10, 20, 30 ...

    if (temperature >= 100) {
      return endState();
    }
  }

  run(newState(Liquid).setLabel("state with end state"));
})();

(() => {
  // transition to newState
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

    if (temperature >= 100) {
      return newState(Vapor);
    }
  }

  function Vapor() {
    console.log("vaporized!");
  }

  run(newState(Liquid).setLabel("state with transition"));
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
  run(newState(Liquid).setLabel("state with event"));
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

  run(newState(Liquid).setLabel("state with externally dispatched event"));
  boilEmitter.send(100);
})();

(() => {
  // send event inside state function

  const [boiled, boilEmitter] = newEvent<number>("boil");
  const [vaporized, vaporizeEmitter] = newEvent("vaporized");

  function Liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useState(0);
    const boiledResult = useEvent(boiled);
    useEffect(() => {
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
    useEffect(() => {
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
    useEffect(() => {
      const inspector = run(Child);
      return inspector.exit; // return a clean up function which remove the child state when parent transitions.
    }, []);
  }
  run(Parent);
})();

(() => {
  function Child(props: { onEnd: () => void }): StateFuncReturn {
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
    console.log(childEnded);
  }

  run(Parent);
})();

(() => {
  function Child() {}

  function Parent() {
    const inspectorRef = useRef<Inspector | null>(null);
    useEffect(() => {
      inspectorRef.current = run(Child);
    }, []);
  }

  run(Parent);
})();

export default {};

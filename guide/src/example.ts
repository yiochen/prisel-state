import {
  run,
  useLocalState,
  useSideEffect,
  newState,
  useEvent,
  useNested,
  endState,
  StateFuncReturn,
} from "../../state";

() => {
  // basic state function
  function liquid() {}
};

() => {
  // state function with prop
  function liquid(liquidType: string) {
    console.log("tyoe of the liquid is " + liquidType);
  }
};

() => {
  // run
  function liquid() {}
  run(liquid);
};

() => {
  // run with props
  function liquid(liquidType: string) {}
  run(liquid, "water");
};

() => {
  // useLocalState
  function liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useLocalState(
      /* initial temperature */ 0
    );

    console.log(temperature);
  }
  run(liquid);
};

(() => {
  // useSideEffect
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
})();

(() => {
  // transition to newState
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
})();

(() => {
  // useEvent
  function liquid(): StateFuncReturn {
    const [boiled, time] = useEvent<number>("boil");
    // typescript wasn't able to infer time is defined if we destructure the
    // tuple before narrowing down the tuple type
    if (boiled && time != undefined) {
      return newState(vapor, time);
    }
  }

  function vapor(timeToBoil: number): StateFuncReturn {
    console.log(`vaporized in ${timeToBoil} seconds`);
  }
})();

(() => {
  // send event outside
  function liquid(): StateFuncReturn {
    const [boiled, time] = useEvent<number>("boil");
    if (boiled && time != undefined) {
      return newState(vapor, time);
    }
  }

  function vapor(timeToBoil: number): StateFuncReturn {
    console.log(`vaporized in ${timeToBoil} seconds`);
  }

  const inspector = run(liquid);
  inspector.send("boil", 10);
})();

(() => {
  // useNested
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
})();

export default {};

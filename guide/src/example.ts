import {
  endState,
  newEvent,
  newState,
  run,
  StateFuncReturn,
  useEvent,
  useInspector,
  useLocalState,
  useNested,
  useSideEffect,
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

  const inspector = run()
    .id("state with externally dispatched event")
    .start(Liquid);
  inspector.send(boilEmitter);
})();

(() => {
  // useInspector

  const [boiled, boilEmitter] = newEvent<number>("boil");
  const [vaporized, vaporizeEmitter] = newEvent("vaporized");

  function Liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useLocalState(0);
    const boiledResult = useEvent(boiled);
    const inspector = useInspector();
    useSideEffect(() => {
      if (boiledResult) {
        setTemperature((oldTemperature) => oldTemperature + 10);
      }
      if (temperature >= 100) {
        inspector.send(vaporizeEmitter);
      }
    });

    if (temperature >= 100) {
      return endState();
    }
  }

  function HeaterActive(): StateFuncReturn {
    const inspector = useInspector();
    const vaporizedResult = useEvent(vaporized);
    useSideEffect(() => {
      const intervalId = setInterval(() => {
        inspector.send(boilEmitter);
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

  const [childStarted, startChild] = newEvent("start-child");
  const [childFinished, finishChild] = newEvent("finish-child");
  function Parent(): StateFuncReturn {
    useSideEffect(() => {
      console.log("parent started");
    }, []);
    const childStartedResult = useEvent(childStarted);
    const [childDone, result] = useNested(!!childStartedResult, Child);
    if (childDone) {
      console.log("parent ended because " + result);
      return endState();
    }
  }
  function Child(): StateFuncReturn {
    useSideEffect(() => {
      console.log("child started");
    }, []);
    const childFinishedResult = useEvent(childFinished);
    if (childFinishedResult) {
      const childMessage = "child ended";
      console.log("child ended by event");
      return endState(childMessage);
    }
  }

  const inspector = run().id("state with nested states").start(Parent);

  runSteps(
    () => inspector.send(startChild),
    () => inspector.send(finishChild)
  );
})();

(() => {
  // full example

  const [userJoined, joinRequest] = newEvent<string>("join-request");
  const [userLeft, leaveRequest] = newEvent<string>("left-request");
  const [codeOfConduct, codeOfConductResponse] = newEvent<string>(
    "code-of-conduct-response"
  );
  const [messageSent, messageRequest] =
    newEvent<{ fromUserId: string; message: string }>("message-request");
  const [broadcastReceived, broadcastMessage] =
    newEvent<{ fromUserId: String; message: string }>("broacast-message");

  const api = {
    send(userId: string, message: any) {
      console.log(`=> ${userId}: ${message}`);
    },
  };

  function ChatroomOpen(capacity: number) {
    const [users, setUsers] = useLocalState<string[]>([]);
    const userJoinedResult = useEvent(userJoined);
    const userLeftResult = useEvent(userLeft);

    console.log(
      `chatroom users: ${users} (userJoined: ${!!userJoinedResult}, userLeft: ${!!userLeftResult})`
    );
    useSideEffect(() => {
      if (userJoinedResult && users.length < capacity) {
        setUsers([...users, userJoinedResult.value]);
        console.log(
          `start a new user state for user ${userJoinedResult.value}`
        );
        run()
          .id(userJoinedResult.value)
          .start(UserJoined, userJoinedResult.value);
      }
      if (userLeftResult && users.includes(userLeftResult.value)) {
        setUsers(users.filter((user) => user != userLeftResult.value));
      }
    });
  }

  // user states

  function UserJoined(userId: string) {
    useSideEffect(() => {
      // let's assume we have a api for sending user request
      console.log(`user ${userId} joined `);
      api.send(userId, "code of conduct");
    }, []);
    const codeOfConductResult = useEvent(
      codeOfConduct.filter((id) => id === userId)
    );
    const left = useLeaveEvent(userId);

    if (left) {
      return newState(UserLeft, userId);
    }
    if (codeOfConductResult) {
      return newState(UserActive, userId);
    }
  }

  function UserActive(userId: string) {
    const inspector = useInspector();
    const messageResult = useEvent(
      messageSent.filter((request) => request.fromUserId === userId)
    );
    useSideEffect(() => {
      if (messageResult) {
        inspector.send(broadcastMessage, messageResult.value);
      }
    });
    const broadcastResult = useEvent(broadcastReceived);
    useSideEffect(() => {
      if (broadcastResult) {
        api.send(
          userId,
          `${broadcastResult.value.fromUserId} says: ${broadcastResult.value.message}`
        );
      }
    });
    const left = useLeaveEvent(userId);

    console.log(`user ${userId} active (message request: ${!!messageResult})`);

    if (left) {
      return newState(UserLeft, userId);
    }
  }

  function useLeaveEvent(userId: string) {
    const userLeftResult = useEvent(userLeft.filter((id) => id === userId));
    return !!userLeftResult;
  }

  function UserLeft(userId: string) {
    const inspector = useInspector();
    useSideEffect(() => {
      inspector.send(leaveRequest, userId);
    }, []);
    console.log(`user ${userId} left`);
    return endState();
  }

  // test

  const inspector = run().id("chat example").start(ChatroomOpen, 10);

  runSteps(
    () => inspector.send(joinRequest, "user-1"),
    () => inspector.send(joinRequest, "user-2"),
    () => inspector.send(codeOfConductResponse, "user-1"),
    () => {
      inspector.send(messageRequest, {
        fromUserId: "user-1",
        message: "hello",
      });
    },
    () => inspector.send(codeOfConductResponse, "user-2"),
    () =>
      inspector.send(messageRequest, {
        fromUserId: "user-2",
        message: "sorry, I just arrived",
      }),
    () => inspector.send(leaveRequest, "user-1"),
    () =>
      inspector.send(messageRequest, {
        fromUserId: "user-2",
        message: "anybody there?",
      }),
    () => inspector.send(leaveRequest, "user-2"),
    () => inspector.debugStates()
  );
})();

export default {};

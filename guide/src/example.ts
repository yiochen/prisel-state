import {
  endState,
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
  function Liquid(): StateFuncReturn {
    const [boiled, time] = useEvent<number>("boil");
    // typescript wasn't able to infer time is defined if we destructure the
    // tuple before narrowing down the tuple type
    if (boiled && time != undefined) {
      return newState(Vapor, time);
    }
  }

  function Vapor(timeToBoil: number): StateFuncReturn {
    console.log(`vaporized in ${timeToBoil} seconds`);
  }
  run().id("state with event").start(Liquid);
})();

(() => {
  // send event outside
  function Liquid(): StateFuncReturn {
    const [boiled, time] = useEvent<number>("boil");
    if (boiled && time != undefined) {
      return newState(Vapor, time);
    }
  }

  function Vapor(timeToBoil: number): StateFuncReturn {
    console.log(`vaporized in ${timeToBoil} seconds`);
  }

  const inspector = run()
    .id("state with externally dispatched event")
    .start(Liquid);
  inspector.send("boil", 10);
})();

(() => {
  // useInspector

  function Liquid(): StateFuncReturn {
    const [temperature, setTemperature] = useLocalState(0);
    const [heated] = useEvent("heat");
    const inspector = useInspector();
    useSideEffect(() => {
      if (heated) {
        setTemperature((oldTemperature) => oldTemperature + 10);
      }
      if (temperature >= 100) {
        inspector.sendAll("vaporized");
      }
    });

    if (temperature >= 100) {
      return endState();
    }
  }

  function HeaterActive(): StateFuncReturn {
    const inspector = useInspector();
    const [vaporized] = useEvent("vaporized");
    useSideEffect(() => {
      const intervalId = setInterval(() => {
        inspector.sendAll("heat");
      }, 100);
      return () => {
        clearInterval(intervalId);
      };
    });
    if (vaporized) {
      return endState();
    }
  }

  run(Liquid);
  run(HeaterActive);
})();

(() => {
  // useNested
  function Parent(): StateFuncReturn {
    useSideEffect(() => {
      console.log("parent started");
    }, []);
    const [startChild] = useEvent("start-child");
    const [childDone, result] = useNested(startChild, Child);
    if (childDone) {
      console.log("parent ended because " + result);
      return endState();
    }
  }
  function Child(): StateFuncReturn {
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

  const inspector = run().id("state with nested states").start(Parent);

  runSteps(
    () => inspector.send("start-child"),
    () => inspector.send("finish-child")
  );
})();

(() => {
  // full example

  const api = {
    send(userId: string, message: any) {
      console.log(`=> ${userId}: ${message}`);
    },
  };

  function ChatroomOpen(capacity: number) {
    const [users, setUsers] = useLocalState<string[]>([]);
    const [userJoined, fromUserId] = useEvent("join-request");
    const [userLeft, leftUserId] = useEvent("user-left");

    console.log(
      `chatroom users: ${users} (userJoined: ${userJoined}, userLeft: ${userLeft})`
    );
    useSideEffect(() => {
      if (userJoined && users.length < capacity && fromUserId != undefined) {
        setUsers([...users, fromUserId]);
        console.log(`start a new user state for user ${fromUserId}`);
        run().id(fromUserId).start(UserJoined, fromUserId);
      }
      if (userLeft && leftUserId != undefined && users.includes(leftUserId)) {
        setUsers(users.filter((user) => user != leftUserId));
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
    const [codeOfConductResponse, fromUserId] = useEvent<string>(
      "code-of-conduct-response"
    );
    const left = useLeaveEvent(userId);

    if (left) {
      return newState(UserLeft, userId);
    }
    if (codeOfConductResponse && userId === fromUserId) {
      return newState(UserActive, userId);
    }
  }

  function UserActive(userId: string) {
    const inspector = useInspector();
    const [receivedMessageRequest, messageRequest] =
      useEvent<{ fromUserId: string; message: string }>("message-request");
    useSideEffect(() => {
      if (receivedMessageRequest && messageRequest?.fromUserId === userId) {
        inspector.sendAll("broadcast-message", messageRequest);
      }
    });
    const [broadcastMessage, broadcastData] =
      useEvent<{ fromUserId: string; message: string }>("broadcast-message");
    useSideEffect(() => {
      if (broadcastMessage && broadcastData) {
        api.send(
          userId,
          `${broadcastData.fromUserId} says: ${broadcastData.message}`
        );
      }
    });
    const left = useLeaveEvent(userId);

    console.log(
      `user ${userId} active (receivedMessageRequest: ${receivedMessageRequest})`
    );

    if (left) {
      return newState(UserLeft, userId);
    }
  }

  function useLeaveEvent(userId: string) {
    const [userLeft, leftUserId] = useEvent("leave-request");
    return userLeft && leftUserId === userId;
  }

  function UserLeft(userId: string) {
    const inspector = useInspector();
    useSideEffect(() => {
      inspector.send("user-left", userId);
    }, []);
    console.log(`user ${userId} left`);
    return endState();
  }

  // test

  const inspector = run().id("chat example").start(ChatroomOpen, 10);

  runSteps(
    () => inspector.sendAll("join-request", "user-1"),
    () => inspector.sendAll("join-request", "user-2"),
    () => inspector.sendAll("code-of-conduct-response", "user-1"),
    () => {
      inspector.sendAll("message-request", {
        fromUserId: "user-1",
        message: "hello",
      });
    },
    () => inspector.sendAll("code-of-conduct-response", "user-2"),
    () =>
      inspector.sendAll("message-request", {
        fromUserId: "user-2",
        message: "sorry, I just arrived",
      }),
    () => inspector.sendAll("leave-request", "user-1"),
    () =>
      inspector.sendAll("message-request", {
        fromUserId: "user-2",
        message: "anybody there?",
      }),
    () => inspector.sendAll("leave-request", "user-2"),
    () => inspector.debugStates()
  );
})();

export default {};

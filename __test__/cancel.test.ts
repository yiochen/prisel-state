import {
  endState,
  Inspector,
  newState,
  run,
  useEffect,
  useState,
  withInspector,
} from "../src";
import { awaitTimeout } from "./testUtils";

describe("cancel", () => {
  test("cancel when running state func", () => {
    let sideEffectCalled = false;
    const MyState = withInspector((inspector) => {
      useEffect(() => {
        sideEffectCalled = true;
      });
      inspector.exit();
    });

    run(MyState);
    expect(sideEffectCalled).toBe(false);
  });

  test("cancel when running side effect", () => {
    let cleanupCalled = false;
    let secondSideEffectCalled = false;
    const MyState = withInspector((inspector) => {
      useEffect(() => {
        inspector.exit();
        return () => {
          cleanupCalled = true;
        };
      });

      useEffect(() => {
        secondSideEffectCalled = true;
      });
    });

    run(MyState);
    expect(cleanupCalled).toBe(true);
    expect(secondSideEffectCalled).toBe(false);
  });

  test("cancel when running cleanup", async () => {
    let firstCleanupCalled = 0;
    let secondCleanupCalled = 0;
    const MyState = withInspector((inspector) => {
      const [, setState] = useState(0);
      useEffect(() => {
        setState(1); // trigger a rerun of state
        return () => {
          firstCleanupCalled++;
          inspector.exit();
        };
      });

      useEffect(() => {
        return () => {
          secondCleanupCalled++;
        };
      });
    });

    run(MyState);
    await awaitTimeout();
    expect(firstCleanupCalled).toBe(secondCleanupCalled);
    expect(secondCleanupCalled).toBe(1);
  });

  test("cancel should cancel children", async () => {
    let childCleanup = false;
    function Parent() {
      useEffect(() => {
        run(Child);
      });
    }

    function Child() {
      useEffect(() => {
        return () => {
          childCleanup = true;
        };
      }, []);
    }

    const inspector = run(Parent);
    await awaitTimeout();
    inspector.exit();
    expect(childCleanup).toBe(true);
  });

  test("child canceling parent", async () => {
    const order: string[] = [];
    const Parent = withInspector((inspector) => {
      useEffect(() => {
        run(Child, inspector);
        return () => {
          order.push("parent cleanup");
        };
      }, []);
    });

    function Child(parentInspector: Inspector) {
      useEffect(() => {
        parentInspector.exit();
        return () => {
          order.push("child cleanup");
        };
      }, []);
    }

    run(Parent);

    expect(order).toEqual(["child cleanup", "parent cleanup"]);
  });

  test("transition should cancel child", (done) => {
    function Parent() {
      const [done, setDone] = useState(false);
      useEffect(() => {
        run(Child);
        setTimeout(() => {
          setDone(true);
        });
      }, []);
      if (done) {
        return newState(Parent2);
      }
    }

    function Parent2() {}

    function Child() {
      useEffect(() => {
        return () => {
          done();
        };
      }, []);
    }

    run(Parent);
  });

  test("cancel during transition", (done) => {
    let parent2Ran = false;
    function Parent() {
      const [timeoutDone, setDone] = useState(false);
      useEffect(() => {
        run(Child);
        setTimeout(() => {
          setDone(true);
          setTimeout(() => {
            // await next timeout, check if Parent2 is ran.
            expect(parent2Ran).toBe(false);
            done();
          });
        });
      }, []);
      if (timeoutDone) {
        return newState(Parent2);
      }
    }

    function Parent2() {
      parent2Ran = true;
    }

    function Child() {
      useEffect(() => {
        return () => {
          // cancel parent, which is currently transitioning
          inspector.exit();
        };
      }, []);
    }

    const inspector = run(Parent);
  });

  test("duplicate cancel calls", async () => {
    const MyState = withInspector((inspector) => {
      useEffect(() => {
        return () => {
          // duplicate cancel. no effect
          inspector.exit();
        };
      }, []);
    });

    const inspector = run(MyState);
    await awaitTimeout();
    inspector.exit();
    await awaitTimeout();
    // should have no error
  });

  test("cancel already canceled", async () => {
    function MyState() {
      return endState(); // endState should automatically cancel self
    }

    const inspector = run(MyState);
    await awaitTimeout;
    inspector.exit();
    await awaitTimeout();
    // should have no error
  });
});

import {
  endState,
  newEvent,
  newState,
  run,
  StateFunc,
  useEvent,
  useLocalState,
  useSideEffect,
  useStored,
} from "../index";
import { awaitTimeout } from "./testUtils";

test("starting a nested state when a condition is true", async () => {
  function useNested(condition: boolean, stateFunc: StateFunc<void>) {
    const [started, setStarted] = useLocalState(false);
    useSideEffect(() => {
      if (condition && !started) {
        setStarted(true);
        const inspector = run(stateFunc);
        return () => inspector.exit();
      }
    });
  }

  let parentCallCount = 0;
  let childCallCount = 0;
  const [triggered, trigger] = newEvent("trigger");
  function parent() {
    parentCallCount++;
    const triggerResult = useEvent(triggered);
    useNested(!!triggerResult, child);
  }
  function child() {
    childCallCount++;
  }
  run(parent);
  await Promise.resolve();
  expect(childCallCount).toBe(0);
  trigger.send();
  await Promise.resolve();
  expect(parentCallCount).toBe(2); // parent rerun due to receiving "trigger" event
  await Promise.resolve();
  expect(childCallCount).toBe(1);
});
function useTrigger(condition: boolean) {
  const stored = useStored(condition);
  if (condition) {
    stored.current = true;
  }
  return stored.current;
}
test("listening for child reaching endstate", async () => {
  let onEndCalled = false;
  // return false is condition is false. But once condition becomes true,
  // remember it and return true afterwards

  function useNested(
    condition: boolean,
    stateFunc: StateFunc<{ onEnd: () => void }>,
    onEnd: () => void
  ) {
    const started = useTrigger(condition);
    useSideEffect(() => {
      if (started) {
        const inspector = run(
          newState(stateFunc, { onEnd }).setLabel("nestedState")
        );
        return () => inspector.exit();
      }
    }, [started]);
  }
  let childRan = false;
  let childDone = false;

  const [ended, emitEnded] = newEvent("ended");
  function parent() {
    const endedResult = useEvent(ended);
    useNested(true, child, () => {
      onEndCalled = true;
      emitEnded.send();
    });
    childDone = childDone || !!endedResult;
  }
  function child(props: { onEnd: () => void }) {
    childRan = true;
    return endState(props);
  }
  run(newState(parent).setLabel("listenForChildEnd"));
  expect(childRan).toBe(false);
  await awaitTimeout();
  expect(childRan).toBe(true);
  expect(onEndCalled).toBe(true);
  expect(childDone).toBe(true);
});

test("cancel nested state when parent transitions", async () => {
  let childCleanupCount = 0;
  function useNested(condition: boolean, stateFunc: StateFunc) {
    const started = useTrigger(condition);
    useSideEffect(() => {
      if (started) {
        const inspector = run(stateFunc);
        return () => inspector.exit();
      }
    }, [started]);
  }
  let parentRan = false;
  function parent() {
    parentRan = true;
    useNested(true, child);
    return newState(parent2);
  }
  let parent2Ran = false;
  function parent2() {
    parent2Ran = true;
  }
  let childRan = false;
  function child() {
    childRan = true;
    useSideEffect(() => {
      return () => {
        childCleanupCount++;
      };
    }, []);
  }
  run(parent);
  await awaitTimeout();
  // child is added to be run in next micro event, but it is immediately marked
  // for deletion. Deletion happens after all current states are run in current
  // micro event, so child didn't get a chance to run
  expect(childRan).toBe(false);
  expect(parent2Ran).toBe(true);
  expect(childCleanupCount).toBe(0);
});

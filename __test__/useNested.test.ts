import {
  endState,
  newState,
  run,
  useEvent,
  useNested,
  useSideEffect,
} from "../index";

test("useNested nested will not start until condition is true", async () => {
  let parentCallCount = 0;
  let childCallCount = 0;
  function parent() {
    parentCallCount++;
    const [triggered] = useEvent("triggered");
    useNested(triggered, child);
  }
  function child() {
    childCallCount++;
  }
  const inspector = run(parent);
  await Promise.resolve();
  expect(childCallCount).toBe(0);
  inspector.send("triggered");
  await Promise.resolve();
  expect(parentCallCount).toBe(2);
  expect(childCallCount).toBe(1);
});

test("useNested returns done when child reaches endState", async () => {
  let childDone = false;
  let childEndProps: any = undefined;
  function parent() {
    const nestedReturn = useNested(true, child);
    childDone = nestedReturn[0];
    childEndProps = nestedReturn[1];
  }
  function child() {
    return endState("result");
  }
  run(parent);
  await Promise.resolve();
  expect(childDone).toBe(false);
  expect(childEndProps).toBe(undefined);
  await Promise.resolve();
  expect(childDone).toBe(true);
  expect(childEndProps).toBe("result");
});

test("useNested cancels child when parent transitions", async () => {
  let childCleanupCount = 0;
  function parent() {
    useNested(true, child);
    return newState(parent2);
  }
  function parent2() {}
  function child() {
    useSideEffect(() => {
      return () => {
        childCleanupCount++;
      };
    }, []);
  }
  run(parent);
  await Promise.resolve();
  expect(childCleanupCount).toBe(1);
});

import {
  newEvent,
  run,
  useEvent,
  useLocalState,
  useSideEffect,
  useStored,
} from "../index";
import { awaitTimeout } from "./testUtils";

test("useStored stores the initial value", async () => {
  let captured = 0;
  function MyState() {
    captured = useStored(2).current;
  }

  run(MyState);
  await Promise.resolve();
  expect(captured).toBe(2);
});

test("useStored doesn't change if called with different initial value", async () => {
  let captured = 0;
  function MyState() {
    const [value, setValue] = useLocalState(1);
    useSideEffect(() => {
      setValue(2);
    }, []);
    captured = useStored(value).current;
  }
  run(MyState);
  await awaitTimeout();
  expect(captured).toBe(1);
});

test("stored value can be modified", async () => {
  const [event, emitter] = newEvent("trigger");
  let captured = 0;
  function MyState() {
    const ref = useStored(1);
    captured = ref.current;
    useEvent(event);
    useSideEffect(() => {
      ref.current = 2;
      emitter.send();
    }, []);
  }
  run(MyState);
  await awaitTimeout();
  expect(captured).toBe(2);
});

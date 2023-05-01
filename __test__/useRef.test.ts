import {
  newEvent,
  run,
  useEffect,
  useEvent,
  useRef,
  useState,
} from "../src/index";
import { awaitTimeout } from "./testUtils";

test("useRef stores the initial value", async () => {
  let captured = 0;
  function MyState() {
    captured = useRef(2).current;
  }

  run(MyState);
  expect(captured).toBe(2);
});

test("useRef doesn't change if called with different initial value", async () => {
  let captured = 0;
  function MyState() {
    const [value, setValue] = useState(1);
    useEffect(() => {
      setValue(2);
    }, []);
    captured = useRef(value).current;
  }
  run(MyState);
  await awaitTimeout();
  expect(captured).toBe(1);
});

test("stored value can be modified", async () => {
  const [event, emitter] = newEvent("trigger");
  let captured = 0;
  function MyState() {
    const ref = useRef(1);
    captured = ref.current;
    useEvent(event);
    useEffect(() => {
      ref.current = 2;
      emitter.send();
    }, []);
  }
  run(MyState);
  await awaitTimeout();
  expect(captured).toBe(2);
});

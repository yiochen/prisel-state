import { run, useLocalState } from "../index";

test("useLocalState", async () => {
  let setStateReturn: any = undefined;
  let stateFuncRunCount = 0;
  function myState() {
    stateFuncRunCount++;
    setStateReturn = useLocalState(true);
  }
  run(myState);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(1);
  expect(setStateReturn[0]).toBe(true);
  const setStateFunc = setStateReturn[1];
  setStateFunc(false);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(2);
  expect(setStateReturn[0]).toBe(false);
  expect(setStateReturn[1]).toBe(setStateFunc); // assert same instance
});

test("useLocalState with function", async () => {
  let setStateReturn: any = undefined;
  function myState() {
    setStateReturn = useLocalState(1);
  }
  run(myState);
  await Promise.resolve();
  setStateReturn[1]((oldState: number) => oldState * 2);
  await Promise.resolve();
  expect(setStateReturn[0]).toBe(2);
});

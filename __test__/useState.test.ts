import { run, useState } from "../src/index";

test("useState", async () => {
  let setStateReturn: any = undefined;
  let stateFuncRunCount = 0;
  function myState() {
    stateFuncRunCount++;
    setStateReturn = useState(true);
  }
  run(myState);
  expect(stateFuncRunCount).toBe(1);
  expect(setStateReturn[0]).toBe(true);
  const setStateFunc = setStateReturn[1];
  setStateFunc(false);
  await Promise.resolve();
  expect(stateFuncRunCount).toBe(2);
  expect(setStateReturn[0]).toBe(false);
  expect(setStateReturn[1]).toBe(setStateFunc); // assert same instance
});

test("useState with function", async () => {
  let setStateReturn: any = undefined;
  function myState() {
    setStateReturn = useState(1);
  }
  run(myState);
  setStateReturn[1]((oldState: number) => oldState * 2);
  await Promise.resolve();
  expect(setStateReturn[0]).toBe(2);
});

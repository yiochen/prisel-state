import { endState, newState, run, sequence, useSideEffect } from "../src/index";

describe("sequence", () => {
  it("runs states in sequence", async () => {
    const result: string[] = [];

    function State1() {
      result.push("state1 ran");
      useSideEffect(() => {
        return () => {
          result.push("state1 exiting");
        };
      }, []);
      return endState({
        onEnd: () => {
          result.push("state1 ended");
        },
      });
    }
    function State2() {
      result.push("state2 ran");
      useSideEffect(() => {
        return () => {
          result.push("state2 exiting");
        };
      }, []);
      return endState({
        onEnd: () => {
          result.push("state2 ended");
        },
      });
    }

    run(
      sequence([newState(State1), newState(State2)], () => {
        result.push("sequence ended");
      })
    );
    await new Promise<void>((resolve) => setTimeout(() => resolve()));

    expect(result).toEqual([
      "state1 ran",
      "state1 exiting",
      "state1 ended",
      "state2 ran",
      "state2 exiting",
      "state2 ended",
      "sequence ended",
    ]);
  });

  it("nested sequence", (done) => {
    let output: string[] = [];
    function State1() {
      output.push("State1");
      return endState();
    }
    function State2dot1() {
      output.push("State2.1");
      return endState();
    }
    function State2dot2() {
      output.push("State2.2");
      return endState();
    }
    function State3() {
      output.push("State3");
      return endState();
    }
    run(
      sequence(
        [
          newState(State1),
          sequence([newState(State2dot1), newState(State2dot2)]),
          newState(State3),
        ],
        () => {
          expect(output).toEqual(["State1", "State2.1", "State2.2", "State3"]);
          done();
        }
      )
    );
  });
});

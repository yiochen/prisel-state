import { newState, run, setLabel, useSideEffect } from "../src/index";

describe("label", () => {
  it("if no label, the use the label of function name", () => {
    const inspector = run(function MyState() {});
    expect(inspector.debugStates()?.stack).toEqual(["MyState"]);
  });

  it("anonymous state", () => {
    const inspector = run(newState(() => {}));
    expect(inspector.debugStates()?.stack).toEqual(["anonymous state"]);
  });

  it("set label on state config", () => {
    const inspector = run(
      newState(function MyState() {}).setLabel("AlternativeName")
    );
    expect(inspector.debugStates()?.stack).toEqual(["AlternativeName"]);
  });

  it("get label on state config", () => {
    expect(newState(function MyState() {}).label).toEqual("MyState");
  });

  it("setLabel", (done) => {
    const inspector = run(() => {
      setLabel("State1");
      expect(inspector.debugStates()?.stack).toEqual(["State1"]);
      done();
    });
  });

  it("parent label", (done) => {
    run(() => {
      setLabel("outer");
      useSideEffect(() => {
        const inspector = run(() => {
          setLabel("inner");
          expect(inspector.debugStates()?.stack).toEqual(["inner", "outer"]);
          done();
        });
      }, []);
    });
  });

  it("state transition", (done) => {
    const inspector = run(() => {
      setLabel("outer1");
      return newState(() => {
        setLabel("outer2");
        expect(inspector.debugStates()?.stack).toEqual(["outer2"]);
        done();
      });
    });
  });

  it("parallel state with transition", (done) => {
    run(() => {
      setLabel("outer1");
      useSideEffect(() => {
        const inspector = run(
          newState(() => {
            setLabel("inner");
            expect(inspector.debugStates()?.stack).toEqual(["inner", "outer1"]);
            done();
          })
        );
      });
      return newState(() => {
        setLabel("outer2");
      });
    });
  });
});

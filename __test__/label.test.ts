import { Inspector, newState, run, setLabel, useEffect } from "../src/index";

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

  it("setLabel", () => {
    const inspector = run(() => {
      setLabel("State1");
    });
    expect(inspector.debugStates()?.stack).toEqual(["State1"]);
  });

  it("parent label", (done) => {
    let inspector: Inspector | null = null;
    run(() => {
      setLabel("outer");
      useEffect(() => {
        inspector = run(() => {
          setLabel("inner");
        });
      }, []);
    });

    expect(inspector!.debugStates()?.stack).toEqual(["inner", "outer"]);
    done();
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
});

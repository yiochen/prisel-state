import {
  endState,
  getAmbient,
  newAmbient,
  newState,
  run,
  StateFuncReturn,
} from "../src/index";
import { useNextTick } from "./testUtils";

describe("generator state", () => {
  it("can run a generator state", (done) => {
    let generatorRan = false;
    run(function* () {
      generatorRan = true;
      return endState({
        onEnd: () => {
          expect(generatorRan).toBe(true);
          done();
        },
      });
    });
  });

  it("yield a state will be ran as nested state", (done) => {
    let output: string[] = [];
    function Child(): StateFuncReturn {
      const done = useNextTick();
      output.push("child ran");
      if (done) {
        return endState({ onEnd: () => output.push("child ended") });
      }
    }
    function* Parent(): StateFuncReturn {
      output.push("parent ran");
      yield newState(Child);
      output.push("returned to parent");
      return endState({
        onEnd: () => {
          expect(output).toEqual([
            "parent ran",
            "child ran",
            "child ran",
            "child ended",
            "returned to parent",
          ]);
          done();
        },
      });
    }
    run(Parent);
  });

  it("transition from generator to generator", (done) => {
    const output: string[] = [];
    function* First() {
      output.push("first state ran");
      return newState(Second);
    }
    function* Second() {
      output.push("second state ran");
      return endState({
        onEnd: () => {
          expect(output).toEqual(["first state ran", "second state ran"]);
          done();
        },
      });
    }
    run(First);
  });

  it("can use ambient", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(
        2,
        newState(function* () {
          expect(getAmbient(ambient)).toBe(2);
          return endState({ onEnd: done });
        })
      )
    );
  });

  it("ambient is passed to next state", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    function* NextState() {
      expect(getAmbient(ambient)).toBe(2);
      return endState({ onEnd: done });
    }
    run(
      provideAmbient(
        2,
        newState(function* () {
          return newState(NextState);
        })
      )
    );
  });

  it("ambient is passed to nested states", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    function* NestedState() {
      expect(getAmbient(ambient)).toBe(2);
      return endState();
    }
    run(
      provideAmbient(
        2,
        newState(function* () {
          yield newState(NestedState);
          return endState({ onEnd: done });
        })
      )
    );
  });
});

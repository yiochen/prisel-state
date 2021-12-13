import {
  getAmbient,
  hasAmbient,
  newAmbient,
  newState,
  run,
  useSideEffect,
} from "../index";

describe("ambient", () => {
  it("create ambient", () => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    expect(ambient.ref.name).toBe("ambient");
    expect(typeof provideAmbient).toBe("function");
  });

  it("getAmbient", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(
        2,
        newState(() => {
          const ambientValue = getAmbient(ambient);
          expect(ambientValue).toBe(2);
          done();
        })
      )
    );
  });

  it("ambient is inherited in follow-on state", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(
        2,
        newState(() => {
          return newState(() => {
            const ambientValue = getAmbient(ambient);
            expect(ambientValue).toBe(2);
            done();
          });
        })
      )
    );
  });

  it("getAmbient with defaultValue", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(
        2,
        newState(() => {
          const ambientValue = getAmbient(ambient, 1);
          expect(ambientValue).toBe(2);
          done();
        })
      )
    );
  });

  it("getAmbient will throw if no ambient is provided", (done) => {
    const [ambient] = newAmbient<number>("ambient");
    run(() => {
      expect(() => getAmbient(ambient)).toThrowError();
      done();
    });
  });

  it("ambient will not automatically be copied to nested states", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(
        2,
        newState(() => {
          useSideEffect(() => {
            run(() => {
              expect(() => getAmbient(ambient)).toThrowError();
              done();
            });
          }, []);
        })
      )
    );
  });

  it("provideAmbient can be curried", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(2)(
        newState(() => {
          expect(getAmbient(ambient)).toBe(2);
          done();
        })
      )
    );
  });

  it("provideAmbient when state transitions", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(() => {
      return provideAmbient(
        2,
        newState(() => {
          expect(getAmbient(ambient)).toBe(2);
          done();
        })
      );
    });
  });

  it("provide mulitple Ambient", (done) => {
    const [ambient1, provideAmbient1] = newAmbient<number>("1");
    const [ambient2, provideAmbient2] = newAmbient<boolean>("2");
    run(
      provideAmbient1(
        2,
        provideAmbient2(
          true,
          newState(() => {
            expect(getAmbient(ambient2)).toBe(true);
            expect(getAmbient(ambient1)).toBe(2);
            done();
          })
        )
      )
    );
  });

  it("provide same ambient can override", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");
    run(
      provideAmbient(
        1,
        provideAmbient(
          2,
          newState(() => {
            expect(getAmbient(ambient)).toBe(1);
            done();
          })
        )
      )
    );
  });

  it("provide same ambient during transition", (done) => {
    const [ambient, provideAmbient] = newAmbient<number>("ambient");

    run(
      provideAmbient(
        1,
        newState(() => {
          expect(getAmbient(ambient)).toBe(1);
          return provideAmbient(
            2,
            newState(() => {
              expect(getAmbient(ambient)).toBe(2);
              done();
            })
          );
        })
      )
    );
  });

  it("hasAmbient", (done) => {
    const [provided, provideAmbient] = newAmbient<number>("provided");
    const [unprovided] = newAmbient<number>("unprovided");
    run(
      provideAmbient(
        1,
        newState(() => {
          expect(hasAmbient(provided)).toBe(true);
          expect(hasAmbient(unprovided)).toBe(false);
          done();
        })
      )
    );
  });
});
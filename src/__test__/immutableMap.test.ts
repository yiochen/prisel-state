import { ImmutableMap } from "../immutableMap";

function expectMap(map: ImmutableMap<any, any>, ...pairs: Array<[any, any]>) {
  for (const [key, value] of pairs) {
    expect(map.get(key)).toBe(value);
  }
}

describe("immutableMap", () => {
  test("set", () => {
    expectMap(
      ImmutableMap.builder().set("a", 1).set("b", 2).build(),
      ["a", 1],
      ["b", 2]
    );
  });

  it("set parent", () => {
    expectMap(
      ImmutableMap.builder()
        .set("a", 1)
        .setParent(ImmutableMap.builder().set("b", 2))
        .build(),
      ["a", 1],
      ["b", 2]
    );
  });

  it("set order", () => {
    expectMap(ImmutableMap.builder().set("a", 1).set("a", 2).build(), ["a", 2]);
  });

  it("setParent with self", () => {
    const a = ImmutableMap.builder().set("a", 1);
    const b = a.set("a", 2);
    expectMap(b.setParent(a).build(), ["a", 2]);
  });

  it("builder is immutable", () => {
    const a = ImmutableMap.builder().set("a", 1);
    a.set("a", 2);
    expectMap(a.build(), ["a", 1]);
  });
});

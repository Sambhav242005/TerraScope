import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runoff,
  distanceKm,
  parseAssets,
  draftPlan,
} from "../src/flood/model.ts";
const settings = { rainScale: 1, loss: 0.35, lag: 8 };
test("illustrative reservoir conserves effective input through every step", () => {
  let input = 0,
    out = 0;
  for (const x of runoff([0, 2, 20, 4, 0, 0, 0], settings)) {
    input += x.input;
    out += x.out;
    assert.ok(Math.abs(input - out - x.storage) < 1e-10);
    assert.ok(x.out >= 0 && x.storage >= 0);
  }
});
test("runoff is deterministic and independent of unrelated runs", () => {
  const rain = [0, 4, 10, 0],
    a = runoff(rain, settings);
  runoff(rain, { rainScale: 2, loss: 0.1, lag: 2 });
  assert.deepEqual(runoff(rain, settings), a);
  assert.deepEqual(rain, [0, 4, 10, 0]);
});
test("unknown or invalid rainfall and settings fail instead of becoming zero", () => {
  for (const x of [null, NaN, Infinity, -1])
    assert.throws(() => runoff([x], settings));
  for (const s of [
    { ...settings, loss: 1.1 },
    { ...settings, lag: 0 },
    { ...settings, rainScale: NaN },
  ])
    assert.throws(() => runoff([1], s));
  assert.deepEqual(runoff([0], settings), [{ input: 0, out: 0, storage: 0 }]);
});
test("linear reservoir scales with rainfall and retains delayed water", () => {
  const a = runoff([10, 0, 0], settings),
    b = runoff([10, 0, 0], { ...settings, rainScale: 2 });
  a.forEach((x, i) => assert.ok(Math.abs(b[i].out - 2 * x.out) < 1e-12));
  assert.ok(a[1].out > 0);
  assert.ok(a.at(-1).storage > 0);
});
test("resource distance is geographical and missing coordinates are excluded", () => {
  assert.equal(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 }), 0);
  assert.ok(
    Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.195) <
      0.01,
  );
  const a = parseAssets({
    elements: [
      { type: "node", id: 1, tags: { amenity: "school" } },
      {
        type: "node",
        id: 2,
        lat: 25,
        lon: 85,
        tags: { name: "School", amenity: "school" },
      },
    ],
  });
  assert.equal(a.length, 1);
  assert.equal(a[0].source, "https://www.openstreetmap.org/node/2");
});
test("checklist distinguishes proximity from flooding and retains unknowns", () => {
  const d = draftPlan([], [], 4);
  assert.match(d, /proximity screening, not modeled inundation/);
  assert.match(d, /no route is declared safe/);
  assert.match(d, /no LLM inference/);
});

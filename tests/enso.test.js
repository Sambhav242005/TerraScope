import test from "node:test";
import assert from "node:assert/strict";
import { getEnsoContextForYear, HISTORICAL_ENSO_SERIES } from "../src/flood/enso.ts";

test("getEnsoContextForYear returns exact NOAA ONI phase for 2015-2024", () => {
  const enso2015 = getEnsoContextForYear(2015);
  assert.equal(enso2015.phase, "El Niño");
  assert.equal(enso2015.oniAnomalyC, 2.2);

  const enso2022 = getEnsoContextForYear(2022);
  assert.equal(enso2022.phase, "La Niña");
  assert.equal(enso2022.oniAnomalyC, -1.0);

  const enso2024 = getEnsoContextForYear(2024);
  assert.equal(enso2024.phase, "Neutral");
  assert.equal(enso2024.oniAnomalyC, -0.3);
});

test("getEnsoContextForYear provides valid fallback with source citation", () => {
  const ensoFallback = getEnsoContextForYear(1999);
  assert.equal(ensoFallback.phase, "Neutral");
  assert.match(ensoFallback.source, /NOAA CPC/);
});

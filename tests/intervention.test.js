import test from "node:test";
import assert from "node:assert/strict";
import {
  createIntervention,
  validateIntervention,
  summarizeInterventions,
  INTERVENTION_DEFAULTS,
} from "../src/flood/intervention.ts";

test("createIntervention generates valid intervention with defaults", () => {
  const coords = { lat: 25.71, lon: 85.16 };
  const basin = createIntervention("storage_basin", coords);
  assert.equal(basin.kind, "storage_basin");
  assert.equal(basin.lat, 25.71);
  assert.equal(basin.lon, 85.16);
  assert.equal(basin.areaM2, INTERVENTION_DEFAULTS.storage_basin.areaM2);
  assert.equal(basin.capacityM3, INTERVENTION_DEFAULTS.storage_basin.capacityM3);
  assert.equal(validateIntervention(basin), true);
});

test("createIntervention respects parameter overrides", () => {
  const coords = { lat: 25.72, lon: 85.17 };
  const solar = createIntervention("solar_array", coords, {
    name: "Custom Solar Farm",
    powerKw: 5000,
    areaM2: 50000,
  });
  assert.equal(solar.name, "Custom Solar Farm");
  assert.equal(solar.powerKw, 5000);
  assert.equal(solar.areaM2, 50000);
  assert.equal(validateIntervention(solar), true);
});

test("validateIntervention rejects invalid coordinate and dimension values", () => {
  assert.equal(validateIntervention(null), false);
  assert.equal(validateIntervention({}), false);
  assert.equal(
    validateIntervention({
      id: "1",
      name: "Bad",
      kind: "storage_basin",
      lat: 95, // invalid lat
      lon: 85,
      areaM2: 100,
    }),
    false,
  );
  assert.equal(
    validateIntervention({
      id: "2",
      name: "Bad Area",
      kind: "wind_turbine",
      lat: 25,
      lon: 85,
      areaM2: -10, // negative area
    }),
    false,
  );
});

test("summarizeInterventions aggregates storage, renewables and buffer area", () => {
  const items = [
    createIntervention("storage_basin", { lat: 25.7, lon: 85.1 }, { capacityM3: 30000 }),
    createIntervention("storage_basin", { lat: 25.71, lon: 85.11 }, { capacityM3: 15000 }),
    createIntervention("solar_array", { lat: 25.72, lon: 85.12 }, { powerKw: 3500 }),
    createIntervention("wind_turbine", { lat: 25.73, lon: 85.13 }, { powerKw: 2000 }),
    createIntervention("vegetation_buffer", { lat: 25.74, lon: 85.14 }, { areaM2: 25000 }),
  ];

  const summary = summarizeInterventions(items);
  assert.equal(summary.total, 5);
  assert.equal(summary.counts.storage_basin, 2);
  assert.equal(summary.counts.solar_array, 1);
  assert.equal(summary.counts.wind_turbine, 1);
  assert.equal(summary.counts.vegetation_buffer, 1);
  assert.equal(summary.totalStorageCapacityM3, 45000);
  assert.equal(summary.totalRenewablePowerKw, 5500);
  assert.equal(summary.totalVegetationAreaM2, 25000);
});

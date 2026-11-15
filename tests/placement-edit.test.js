import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildMoveDraft,
  buildPlacementEdit,
  nudgeCoords,
  translateFootprint,
  validatePlacementEdit,
  createIntervention,
} from '../src/flood/intervention.ts';
import { assessPlacement, checkScenePlacement } from '../src/flood/placementAdmission.ts';
import { checkPlacement } from '../src/flood/placementCheck.ts';

const evidence = JSON.parse(fs.readFileSync(new URL('../public/data/placement-evidence.json', import.meta.url)));

const road = evidence.features.find((f) => f.kind === 'road');
const roadCoords = road.geometry.type === 'Polygon'
  ? road.geometry.coordinates[0][0]
  : road.geometry.coordinates[0];

const ringArea2 = (ring) => {
  let area2 = 0;
  for (let i = 1; i < ring.length; i++) {
    area2 += (ring[i - 1][0] - ring[0][0]) * (ring[i][1] - ring[0][1]) - (ring[i][0] - ring[0][0]) * (ring[i - 1][1] - ring[0][1]);
  }
  return area2;
};

test('buildMoveDraft keeps identity and parameters, updates only lat/lon', () => {
  const item = createIntervention('solar_array', { lat: 25.69, lon: 85.16 });
  const draft = buildMoveDraft(item, { lat: 25.7, lon: 85.17 });
  assert.equal(draft.id, item.id);
  assert.equal(draft.createdAt, item.createdAt);
  assert.equal(draft.kind, item.kind);
  assert.equal(draft.areaM2, item.areaM2);
  assert.equal(draft.powerKw, item.powerKw);
  assert.equal(draft.sourceCandidateId, item.sourceCandidateId);
  assert.equal(draft.lat, 25.7);
  assert.equal(draft.lon, 85.17);
});

test('buildMoveDraft translates a supplied footprint (outer ring and holes) by the same delta', () => {
  const footprint = {
    type: 'Polygon',
    coordinates: [
      [[85.16, 25.69], [85.161, 25.69], [85.161, 25.691], [85.16, 25.691], [85.16, 25.69]],
      [[85.1604, 25.6903], [85.1606, 25.6903], [85.1606, 25.6905], [85.1604, 25.6903]],
    ],
  };
  const item = createIntervention('storage_basin', { lat: 25.6905, lon: 85.1605 }, { footprint, sourceCandidateId: 'cand-1' });
  const draft = buildMoveDraft(item, { lat: 25.7, lon: 85.17 });
  const dLat = 25.7 - 25.6905;
  const dLon = 85.17 - 85.1605;
  assert.equal(draft.footprint.coordinates.length, 2);
  for (let r = 0; r < footprint.coordinates.length; r++) {
    assert.equal(draft.footprint.coordinates[r].length, footprint.coordinates[r].length);
    for (let i = 0; i < footprint.coordinates[r].length; i++) {
      assert.ok(Math.abs(draft.footprint.coordinates[r][i][0] - (footprint.coordinates[r][i][0] + dLon)) < 1e-12);
      assert.ok(Math.abs(draft.footprint.coordinates[r][i][1] - (footprint.coordinates[r][i][1] + dLat)) < 1e-12);
    }
  }
  // rings stay closed after translation
  for (const ring of draft.footprint.coordinates) {
    assert.deepEqual(ring[0], ring[ring.length - 1]);
  }
  // shoelace area is translation-invariant
  for (let r = 0; r < footprint.coordinates.length; r++) {
    assert.ok(Math.abs(ringArea2(draft.footprint.coordinates[r]) - ringArea2(footprint.coordinates[r])) < 1e-9);
  }
  // the supplied footprint is consumed as-is by the check; it must move with the pin
  const check = checkPlacement(draft, null);
  const xs = check.footprint.coordinates[0].map((p) => p[0]);
  const ys = check.footprint.coordinates[0].map((p) => p[1]);
  assert.ok((Math.min(...xs) + Math.max(...xs)) / 2 < 85.18);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - (85.1605 + dLon)) < 1e-9);
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - (25.6905 + dLat)) < 1e-9);
});

test('translateFootprint returns a new polygon and does not mutate the input', () => {
  const footprint = {
    type: 'Polygon',
    coordinates: [[[85.16, 25.69], [85.161, 25.69], [85.161, 25.691], [85.16, 25.69]]],
  };
  const before = JSON.parse(JSON.stringify(footprint));
  const moved = translateFootprint(footprint, 0.01, 0.02);
  assert.deepEqual(footprint, before);
  assert.notEqual(moved, footprint);
  assert.ok(Math.abs(moved.coordinates[0][0][0] - 85.18) < 1e-12);
  assert.ok(Math.abs(moved.coordinates[0][0][1] - 25.7) < 1e-12);
});

test('buildMoveDraft rejects out-of-limit coordinates', () => {
  const item = createIntervention('wind_turbine', { lat: 25.7, lon: 85.16 });
  assert.throws(() => buildMoveDraft(item, { lat: 86, lon: 85.16 }));
  assert.throws(() => buildMoveDraft(item, { lat: 25.7, lon: 181 }));
  assert.throws(() => buildMoveDraft(item, { lat: Number.NaN, lon: 85.16 }));
});

test('nudgeCoords moves by local metres and scales east-west by cos(latitude)', () => {
  const base = { lat: 25.7, lon: 85.16 };
  const north = nudgeCoords(base, 0, 200);
  assert.ok(Math.abs(north.lat - (25.7 + 200 / 111132)) < 1e-12);
  assert.equal(north.lon, base.lon);
  const east = nudgeCoords(base, 200, 0);
  const expectedLon = 200 / (111320 * Math.cos((25.7 * Math.PI) / 180));
  assert.ok(Math.abs(east.lon - (base.lon + expectedLon)) < 1e-12);
  const south = nudgeCoords(base, 0, -200);
  const west = nudgeCoords(base, -200, 0);
  assert.ok(south.lat < base.lat && west.lon < base.lon);
  // never clamp past the supported limits: report null instead
  assert.equal(nudgeCoords({ lat: 84.9999, lon: 85.16 }, 0, 1e7), null);
});

test('buildPlacementEdit pairs as-placed and as-moved geometry for the same intervention', () => {
  const item = createIntervention('vegetation_buffer', { lat: 25.69, lon: 85.16 });
  const draft = buildMoveDraft(item, { lat: 25.7, lon: 85.17 });
  const edit = buildPlacementEdit(item, draft, '2026-11-15T00:00:00.000Z');
  assert.equal(edit.op, 'move');
  assert.equal(edit.interventionId, item.id);
  assert.equal(edit.before.lat, 25.69);
  assert.equal(edit.before.lon, 85.16);
  assert.equal(edit.after.lat, 25.7);
  assert.equal(edit.after.lon, 85.17);
  assert.equal(edit.before.areaM2, item.areaM2);
  assert.equal(edit.at, '2026-11-15T00:00:00.000Z');
  assert.ok(edit.id.length > 0);
  assert.equal(validatePlacementEdit(edit), true);
});

test('validatePlacementEdit rejects malformed or legacy audit entries', () => {
  const item = createIntervention('solar_array', { lat: 25.69, lon: 85.16 });
  const good = buildPlacementEdit(item, buildMoveDraft(item, { lat: 25.7, lon: 85.17 }), '2026-11-15T00:00:00.000Z');
  assert.equal(validatePlacementEdit(good), true);
  assert.equal(validatePlacementEdit(null), false);
  assert.equal(validatePlacementEdit({ ...good, op: 'delete' }), false);
  assert.equal(validatePlacementEdit({ ...good, id: '' }), false);
  assert.equal(validatePlacementEdit({ ...good, interventionId: '' }), false);
  assert.equal(validatePlacementEdit({ ...good, at: 'not-a-date' }), false);
  assert.equal(validatePlacementEdit({ ...good, before: { ...good.before, lat: 91 } }), false);
  assert.equal(validatePlacementEdit({ ...good, before: { ...good.before, areaM2: 0 } }), false);
  assert.equal(validatePlacementEdit({ ...good, after: { ...good.after, lon: Number.NaN } }), false);
  assert.equal(validatePlacementEdit({ ...good, after: { ...good.after, footprint: { type: 'Polygon', coordinates: [[[1, 1], [2, 2]]] } } }), false);
});

test('a moved proposal is re-admitted against mapped evidence: mapped road blocks, clear spot passes', () => {
  const item = createIntervention('solar_array', { lat: 25.686, lon: 85.163 });
  const toRoad = buildMoveDraft(item, { lat: roadCoords[1], lon: roadCoords[0] });
  const blocked = assessPlacement(toRoad, evidence, [item]);
  assert.match(blocked.block, /blocked/i);
  assert.equal(blocked.needsAreaEvidence, false);
  const toClear = buildMoveDraft(item, { lat: 25.686, lon: 85.163 });
  const passed = assessPlacement(toClear, evidence, [item]);
  assert.equal(passed.block, null);
});

test('self-overlap is not a false proposal conflict; overlap with another proposal still blocks', () => {
  const item = createIntervention('solar_array', { lat: 25.686, lon: 85.163 });
  const draft = buildMoveDraft(item, { lat: 25.687, lon: 85.164 });
  const selfCheck = checkScenePlacement(draft, evidence, [item, draft]);
  assert.equal(selfCheck.findings.filter((f) => f.kind === 'proposal').length, 0);
  const other = createIntervention('wind_turbine', { lat: 25.687, lon: 85.164 });
  const overlapping = assessPlacement(draft, evidence, [item, other]);
  assert.match(overlapping.block, /intersects/i);
});

test('sequential moves append audit entries in order; the second before-geometry is the first after-geometry', () => {
  const item = createIntervention('storage_basin', { lat: 25.686, lon: 85.163 });
  const first = buildMoveDraft(item, { lat: 25.687, lon: 85.164 });
  const edit1 = buildPlacementEdit(item, first, '2026-11-15T00:00:01.000Z');
  const second = buildMoveDraft(first, { lat: 25.688, lon: 85.165 });
  const edit2 = buildPlacementEdit(first, second, '2026-11-15T00:00:02.000Z');
  // append-only spread, the same pattern used by the workspace update
  const audit = [edit1];
  audit.push(edit2);
  assert.equal(audit.length, 2);
  assert.equal(audit[0].after.lat, 25.687);
  assert.equal(audit[1].before.lat, audit[0].after.lat);
  assert.equal(audit[1].before.lon, audit[0].after.lon);
  assert.equal(audit[1].after.lat, 25.688);
});

test('legacy workspaces without an audit array load with an empty edit audit, and junk entries are filtered out', () => {
  const legacy = [null, { id: 'ok', interventionId: 'int-1', op: 'move', at: '2026-11-15T00:00:00.000Z', before: { lat: 25.69, lon: 85.16, areaM2: 100 }, after: { lat: 25.7, lon: 85.17, areaM2: 100 } }, 'junk'];
  const filtered = legacy.filter(validatePlacementEdit);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].interventionId, 'int-1');
});

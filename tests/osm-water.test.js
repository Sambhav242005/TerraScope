import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWaterTags,
  extractWaterFeatures,
  osmMapApiUrl,
} from '../src/flood/storage/osmWater.ts';

function node(id, lat, lon) {
  return { type: 'node', id, lat, lon };
}

function squareWay(id, tags, { open = false } = {}) {
  const refs = [id * 10 + 1, id * 10 + 2, id * 10 + 3, id * 10 + 4];
  return {
    way: { type: 'way', id, nodes: open ? refs : [...refs, refs[0]], tags },
    nodes: [
      node(refs[0], 25.710, 85.159),
      node(refs[1], 25.710, 85.161),
      node(refs[2], 25.708, 85.161),
      node(refs[3], 25.708, 85.159),
    ],
  };
}

function docOf(...parts) {
  return {
    version: '0.6',
    elements: parts.flatMap((p) => (p.way ? [p.way, ...p.nodes] : [p])),
  };
}

test('closed water ways become polygons with ids, labels and bboxes', () => {
  const first = squareWay(1, { natural: 'water', name: 'Gadheri Talab', 'name:en': 'Gadheri Pond' });
  const result = extractWaterFeatures(docOf(first));
  assert.equal(result.features.length, 1);
  const feature = result.features[0];
  assert.equal(feature.id, 'way/1');
  assert.equal(feature.kind, 'water');
  assert.equal(feature.label, 'Gadheri Pond');
  assert.equal(feature.outer.length, 5);
  assert.deepEqual(feature.outer[0], feature.outer.at(-1));
  assert.deepEqual(feature.bbox, { west: 85.159, south: 25.708, north: 25.710, east: 85.161 });
  assert.equal(result.skippedOpenWays, 0);
  assert.equal(result.skippedWaterRelations, 0);

  const namedOnly = squareWay(2, { natural: 'water', name: 'Talab' });
  assert.equal(extractWaterFeatures(docOf(namedOnly)).features[0].label, 'Talab');
  const unnamed = squareWay(3, { natural: 'water' });
  assert.equal(extractWaterFeatures(docOf(unnamed)).features[0].label, null);
});

test('wetland, reservoir and riverbank tags map to their own kinds', () => {
  const docs = [
    [squareWay(11, { natural: 'wetland' }), 'wetland'],
    [squareWay(12, { landuse: 'reservoir' }), 'reservoir'],
    [squareWay(13, { waterway: 'riverbank' }), 'riverbank'],
    [squareWay(14, { landuse: 'basin' }), 'basin'],
    [squareWay(15, { landuse: 'pond' }), 'pond'],
  ];
  for (const [part, kind] of docs)
    assert.equal(extractWaterFeatures(docOf(part)).features[0].kind, kind);
});

test('open and incomplete water ways are counted, never silently clipped', () => {
  const openWay = squareWay(21, { natural: 'water' }, { open: true });
  const openResult = extractWaterFeatures(docOf(openWay));
  assert.equal(openResult.features.length, 0);
  assert.equal(openResult.skippedOpenWays, 1);

  // A referenced node missing from the document: suspicious, counted.
  const incomplete = squareWay(22, { natural: 'water' });
  incomplete.way.nodes = [221, 222, 999999, 221];
  incomplete.nodes = incomplete.nodes.filter((n) => n.id !== 999999);
  const incompleteResult = extractWaterFeatures(docOf(incomplete));
  assert.equal(incompleteResult.features.length, 0);
  assert.equal(incompleteResult.skippedOpenWays, 1);
});

test('water-tagged relations are counted as unsupported multipolygons', () => {
  const relation = {
    type: 'relation',
    id: 31,
    members: [],
    tags: { type: 'multipolygon', natural: 'water' },
  };
  const nonWaterRelation = { type: 'relation', id: 32, members: [], tags: { type: 'route' } };
  const result = extractWaterFeatures({ elements: [relation, nonWaterRelation] });
  assert.equal(result.skippedWaterRelations, 1);
  assert.equal(result.features.length, 0);
});

test('non-water ways and non-water relations are ignored', () => {
  const building = squareWay(41, { building: 'yes' });
  const highwayLine = squareWay(42, { highway: 'track' }, { open: true });
  const result = extractWaterFeatures(docOf(building, highwayLine));
  assert.equal(result.features.length, 0);
  assert.equal(result.skippedOpenWays, 0);
});

test('malformed documents throw rather than returning empty evidence', () => {
  assert.throws(() => extractWaterFeatures(null), /valid JSON map document/);
  assert.throws(() => extractWaterFeatures({}), /valid JSON map document/);
  assert.throws(() => extractWaterFeatures({ elements: {} }), /valid JSON map document/);
});

test('classifyWaterTags implements the documented union and precedence', () => {
  assert.equal(classifyWaterTags({ natural: 'water' }), 'water');
  assert.equal(classifyWaterTags({ natural: 'wetland' }), 'wetland');
  assert.equal(classifyWaterTags({ landuse: 'reservoir' }), 'reservoir');
  assert.equal(classifyWaterTags({ landuse: 'basin' }), 'basin');
  assert.equal(classifyWaterTags({ landuse: 'pond' }), 'pond');
  assert.equal(classifyWaterTags({ waterway: 'riverbank' }), 'riverbank');
  // Precedence follows the rule list: wetland/reservoir before natural=water.
  assert.equal(classifyWaterTags({ natural: 'water', landuse: 'reservoir' }), 'reservoir');
  assert.equal(classifyWaterTags({ natural: 'wetland', landuse: 'reservoir' }), 'wetland');
  assert.equal(classifyWaterTags({ natural: 'water', waterway: 'riverbank' }), 'water');
  assert.equal(classifyWaterTags({ natural: 'wood' }), null);
  assert.equal(classifyWaterTags({ waterway: 'river' }), null);
  assert.equal(classifyWaterTags({}), null);
  assert.equal(classifyWaterTags(undefined), null);
});

test('osmMapApiUrl formats the bounded bbox and refuses oversized extracts', () => {
  const url = osmMapApiUrl({ west: 85.1, south: 25.6, east: 85.2, north: 25.7 });
  assert.equal(url, 'https://api.openstreetmap.org/api/0.6/map.json?bbox=85.1,25.6,85.2,25.7');

  const rounded = osmMapApiUrl({
    west: 85.123456789,
    south: 25.6,
    east: 85.2,
    north: 25.7,
  });
  assert.ok(rounded.includes('bbox=85.1234568,25.6,85.2,25.7'));

  // 0.2 sq deg is the inclusive policy limit; above it the request is refused.
  assert.doesNotThrow(() => osmMapApiUrl({ west: 0, south: 0, east: 0.5, north: 0.4 }));
  assert.throws(() => osmMapApiUrl({ west: 0, south: 0, east: 1, north: 1 }));
  assert.throws(() => osmMapApiUrl({ west: 85.2, south: 25.6, east: 85.1, north: 25.7 }));
});

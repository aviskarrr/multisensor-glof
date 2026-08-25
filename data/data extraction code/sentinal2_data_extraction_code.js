// ============================================================
// SENTINEL-2 STANDALONE MONTHLY EXPORT
// ============================================================
// Project: Multi-Sensor Spatio-Temporal ML Framework for
//          Glacial Lake Hazard Assessment in Nepal
//
// PERIOD: 2015-01 to 2025-12 (132 months)
// OUTPUT: s2_batchNN.csv  (GL_ID, date, year, month,
//         S2_observations, S2_NDWI_mean, S2_water_area_km2)
//
// NOTE: S2 SR coverage begins mid-2017. Rows before that will
// legitimately have S2_observations = 0 and null stats.
//
// CHANGE LOG vs original script:
// - Standalone: no cross-sensor joins, no shared master table
// - BATCH_SIZE reduced to 15 (was 50) — tune based on task success
// - START_INDEX/BATCH_SIZE control which lakes this run covers
// - Removed ee.Algorithms.If() — dummy image merged directly into
//   the monthly ImageCollection so .median() never fails
// - tileScale raised to 8 (reduceRegions doesn't support bestEffort —
//   that's a reduceRegion-only param)
// - GL_ID is used as the primary project key
// ============================================================


// ============================================================
// 0. BATCH CONTROL — EDIT THESE TWO LINES PER RUN
// ============================================================

var START_INDEX = 400;     // 0, 15, 30, 45 ... increment per batch
var BATCH_SIZE   = 100;   // keep small on free tier; raise later if stable

var BATCH_LABEL = 'batch_' +
  (START_INDEX / BATCH_SIZE + 1 < 10 ? '0' : '') +
  (START_INDEX / BATCH_SIZE + 1);


// ============================================================
// 1. LOAD LAKES FOR THIS BATCH ONLY
// ============================================================

var allLakes = ee.FeatureCollection(
  'projects/geospatial-506003/assets/lake_inventory_icimod'
);

var batch = ee.FeatureCollection(
  allLakes.toList(BATCH_SIZE, START_INDEX)
);

print('Lakes in this batch:', batch.size());
print('GL_IDs:', batch.aggregate_array('GL_ID'));

var batchGeometry = batch.geometry();

Map.centerObject(batch, 8);
Map.addLayer(batch, {color: 'red'}, BATCH_LABEL);


// ============================================================
// 2. TIME SETTINGS
// ============================================================

var START_YEAR = 2015;
var END_YEAR = 2025;

var startDate = ee.Date.fromYMD(START_YEAR, 1, 1);
var endDate = ee.Date.fromYMD(END_YEAR + 1, 1, 1);

var monthStarts = ee.List.sequence(0, 131).map(function(n) {
  return startDate.advance(ee.Number(n), 'month');
});


// ============================================================
// 3. LOAD SENTINEL-2 SR + CLOUD PROBABILITY, JOIN, MASK
// ============================================================

var s2Raw = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(batchGeometry)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
  .select(['B3', 'B8', 'SCL']);

var s2CloudProbability = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY')
  .filterBounds(batchGeometry)
  .filterDate(startDate, endDate);

var s2Joined = ee.Join.saveFirst('cloud_probability').apply({
  primary: s2Raw,
  secondary: s2CloudProbability,
  condition: ee.Filter.equals({
    leftField: 'system:index',
    rightField: 'system:index'
  })
});

function maskS2(image) {
  var cloudProbability = ee.Image(image.get('cloud_probability')).select('probability');
  var cloudMask = cloudProbability.lt(50);

  var scl = image.select('SCL');
  var sclMask = scl.neq(3).and(scl.neq(8)).and(scl.neq(9))
    .and(scl.neq(10)).and(scl.neq(11));

  return image.updateMask(cloudMask).updateMask(sclMask)
    .select(['B3', 'B8'])
    .copyProperties(image, ['system:time_start']);
}

var s2Masked = ee.ImageCollection(s2Joined).map(maskS2);

print('S2 images before masking:', s2Raw.size());
print('S2 cloud-masked collection:', s2Masked.size());


// ============================================================
// 4. DUMMY IMAGE — guarantees .median() never errors on empty months
// ============================================================

var emptyS2Template = ee.Image.constant([0, 0])
  .rename(['B3', 'B8'])
  .updateMask(ee.Image.constant(0));


// ============================================================
// 5. MONTHLY NDWI + WATER AREA TABLE
// ============================================================

var s2Monthly = ee.FeatureCollection(

  monthStarts.map(function(dateObject) {

    var date = ee.Date(dateObject);
    var nextDate = date.advance(1, 'month');

    var monthly = s2Masked.filterDate(date, nextDate);
    var observationCount = monthly.size();

    var dummy = ee.Image(emptyS2Template).set('system:time_start', date.millis());

    var monthlyWithDummy = ee.ImageCollection(
      monthly.merge(
        ee.ImageCollection([dummy])
      )
    );

    var composite = monthlyWithDummy.median();

    var ndwi = composite
      .normalizedDifference(['B3', 'B8'])
      .rename('NDWI');

    var waterMask = ndwi.gt(0);

    var waterArea = waterMask
      .multiply(ee.Image.pixelArea())
      .rename('S2_water_area_m2');

    var s2Image = ee.Image([
      ndwi,
      waterArea
    ]);

    var stats = s2Image.reduceRegions({
      collection: batch,

      reducer: ee.Reducer.mean()
        .combine({
          reducer2: ee.Reducer.sum(),
          sharedInputs: false
        }),

      scale: 10,
      tileScale: 8,
      maxPixelsPerRegion: 1e7
    });

    return stats.map(function(feature) {

      var waterAreaSum = feature.get('sum');

      var waterAreaKm2 = ee.Algorithms.If(
        ee.Algorithms.IsEqual(waterAreaSum, null),
        null,
        ee.Number(waterAreaSum).divide(1e6)
      );

      return ee.Feature(null, {

        GL_ID: feature.get('GL_ID'),

        date: date.format('YYYY-MM'),

        year: date.get('year'),

        month: date.get('month'),

        S2_observations: observationCount,

        S2_NDWI_mean: feature.get('mean'),

        S2_water_area_km2: waterAreaKm2

      });

    });

  })

).flatten();

print(
  'S2 monthly rows (expected = lakes x 132):',
  s2Monthly.size()
);

print(
  'Preview — first 12 rows:',
  s2Monthly.limit(12)
);


// ============================================================
// 6. EXPORT
// ============================================================

Export.table.toDrive({

  collection: s2Monthly,

  description: 'S2_' + BATCH_LABEL,

  fileNamePrefix: 's2_' + BATCH_LABEL,

  fileFormat: 'CSV',

  selectors: [
    'GL_ID',
    'date',
    'year',
    'month',
    'S2_observations',
    'S2_NDWI_mean',
    'S2_water_area_km2'
  ]

});


// ============================================================
// END
// ============================================================
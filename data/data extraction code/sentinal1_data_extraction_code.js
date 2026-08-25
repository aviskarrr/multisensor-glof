// ============================================================
// SENTINEL-1 BATCHED MONTHLY EXPORT (keyed on GL_ID)
// ============================================================

// ============================================================
// 0. BATCH CONTROL — EDIT THESE TWO LINES PER RUN
// ============================================================

var START_INDEX = 400;
var BATCH_SIZE  = 100;   // <-- flagging this: heavy for S1. If you hit
                          // memory exceeded again, drop to 10-15 and
                          // run more batches instead. This is very
                          // likely the next failure point, separate
                          // from the Id/GL_ID fix below.

var BATCH_LABEL = 'batch_' +
  (START_INDEX / BATCH_SIZE + 1 < 10 ? '0' : '') +
  (START_INDEX / BATCH_SIZE + 1);


// ============================================================
// 1. LOAD LAKES FOR THIS BATCH ONLY
// ============================================================

var allLakes = ee.FeatureCollection(
  "projects/glof-506007/assets/lake_inv"
);

var batch = ee.FeatureCollection(
  allLakes.toList(BATCH_SIZE, START_INDEX)
);

print('Lakes in this batch:', batch.size());
print('Glacier IDs (GL_ID):', batch.aggregate_array('GL_ID'));

var batchGeometry = batch.geometry();


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
// 3. LOAD SENTINEL-1 GRD, FILTER, SELECT BANDS EARLY
// ============================================================

var s1Raw = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(batchGeometry)
  .filterDate(startDate, endDate)
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
  .select(['VV', 'VH', 'angle']);

print('S1 images in batch region/period:', s1Raw.size());


// ============================================================
// 4. DUMMY IMAGE — guarantees .median() never errors on empty months
// ============================================================

var emptyS1Template = ee.Image.constant([0, 0, 0])
  .rename(['VV', 'VH', 'angle'])
  .updateMask(ee.Image.constant(0));


// ============================================================
// 5. MONTHLY VV/VH/ANGLE STATS TABLE
// ============================================================

var combinedReducer = ee.Reducer.mean()
  .combine({reducer2: ee.Reducer.median(), sharedInputs: true})
  .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true});

var s1Monthly = ee.FeatureCollection(

  monthStarts.map(function(dateObject) {

    var date = ee.Date(dateObject);
    var nextDate = date.advance(1, 'month');

    var monthly = s1Raw.filterDate(date, nextDate);
    var observationCount = monthly.size();

    var dummy = ee.Image(emptyS1Template).set('system:time_start', date.millis());
    var monthlyWithDummy = ee.ImageCollection(monthly.merge(ee.ImageCollection([dummy])));

    var composite = monthlyWithDummy.median();

    var stats = composite.reduceRegions({
      collection: batch,
      reducer: combinedReducer,
      scale: 10,
      tileScale: 8,
      maxPixelsPerRegion: 1e7
    });

    return stats.map(function(feature) {
      return ee.Feature(null, {
        GL_ID: feature.get('GL_ID'),
        Id: feature.get('Id'),          // kept as a descriptive attribute,
                                         // not the join key — useful for
                                         // cross-checking against ICIMOD
        date: date.format('YYYY-MM'),
        year: date.get('year'),
        month: date.get('month'),
        S1_observations: observationCount,
        VV_mean: feature.get('VV_mean'),
        VV_median: feature.get('VV_median'),
        VV_stdDev: feature.get('VV_stdDev'),
        VH_mean: feature.get('VH_mean'),
        VH_median: feature.get('VH_median'),
        VH_stdDev: feature.get('VH_stdDev'),
        angle_mean: feature.get('angle_mean')
      });
    });

  })

).flatten();

print('S1 monthly rows (expected = lakes x 132):', s1Monthly.size());
print('Preview — first 12 rows:', s1Monthly.limit(12));


// ============================================================
// 6. EXPORT
// ============================================================

Export.table.toDrive({
  collection: s1Monthly,
  description: 'S1_' + BATCH_LABEL,
  fileNamePrefix: 's1_' + BATCH_LABEL,
  fileFormat: 'CSV',
  selectors: [
    'GL_ID',
    'Id',
    'date',
    'year',
    'month',
    'S1_observations',
    'VV_mean',
    'VV_median',
    'VV_stdDev',
    'VH_mean',
    'VH_median',
    'VH_stdDev',
    'angle_mean'
  ]
});

// ============================================================
// END
// ============================================================
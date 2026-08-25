// ============================================================
// MODIS_LST_Monthly.js
// MODIS MOD11A2 (Terra, 8-day, 1km) -> Monthly LST per Lake (5 km buffer)
// Project: major-project-505914
// Outputs: LST_Day_C and LST_Night_C (Celsius), monthly, per lake
// ============================================================

// ------------------------------------------------------------
// STEP 1: Load lake inventory
// ------------------------------------------------------------
var lakes = ee.FeatureCollection(
  'projects/major-project-505914/assets/lake_inventory_5districts'
);

print('Total lakes:', lakes.size()); // should print 494

// ------------------------------------------------------------
// STEP 2: Create centroid for each lake
// ------------------------------------------------------------
var centroids = lakes.map(function(f) {
  return f.setGeometry(f.geometry().centroid({maxError: 1}));
});

// ------------------------------------------------------------
// STEP 3: Create 5 km buffer around each centroid
// ------------------------------------------------------------
var buffers = centroids.map(function(f) {
  return f.setGeometry(f.geometry().buffer(5000)); // 5000 m = 5 km
});

// Quick visual check (optional)
Map.centerObject(lakes, 8);
Map.addLayer(lakes, {color: 'blue'}, 'Lakes');
Map.addLayer(buffers, {color: 'orange'}, 'Buffers');

// ------------------------------------------------------------
// STEP 4: Load MODIS MOD11A2 (8-day LST composite, 1km)
// LST_Day_1km / LST_Night_1km are raw digital numbers.
// Raw x 0.02 = Kelvin. Kelvin - 273.15 = Celsius.
// Fill value is 0 (no valid retrieval) -> must mask before averaging.
// ------------------------------------------------------------
var modis = ee.ImageCollection('MODIS/061/MOD11A2')
  .select(['LST_Day_1km', 'LST_Night_1km']);

function toCelsius(img) {
  var day = img.select('LST_Day_1km')
    .updateMask(img.select('LST_Day_1km').gt(0))
    .multiply(0.02).subtract(273.15)
    .rename('LST_Day_C');

  var night = img.select('LST_Night_1km')
    .updateMask(img.select('LST_Night_1km').gt(0))
    .multiply(0.02).subtract(273.15)
    .rename('LST_Night_C');

  return day.addBands(night)
    .copyProperties(img, ['system:time_start']);
}

var modisC = modis.map(toCelsius);

// ------------------------------------------------------------
// STEP 5: Function to build ONE monthly LST image
// (averages all 8-day composites whose start date falls in that month)
// ------------------------------------------------------------
function monthlyLST(year, month) {
  year = ee.Number(year);
  month = ee.Number(month);
  var start = ee.Date.fromYMD(year, month, 1);
  var end = start.advance(1, 'month');

  var monthCol = modisC.filterDate(start, end);

  var meanImg = monthCol.mean(); // masked pixels excluded automatically

  return meanImg.set({
    'year': year,
    'month': month,
    'system:time_start': start.millis(),
    'image_count': monthCol.size() // how many 8-day composites went into this month (QA)
  });
}

// ------------------------------------------------------------
// STEP 6: TEST — single month (July 2024), single lake
// Run this first. Check the Console before doing anything else.
// ------------------------------------------------------------
var testImage = monthlyLST(2024, 7);
print('Test image (July 2024) info:', testImage);
print('Number of 8-day composites used in July 2024:', testImage.get('image_count'));

var firstLake = ee.Feature(buffers.first());

var testResult = testImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: firstLake.geometry(),
  scale: 1000, // MODIS LST native resolution
  tileScale: 4
});

print('Test result — July 2024, first lake (Day C, Night C):', testResult);
// Sanity check: high-elevation Khumbu/Annapurna lakes in July should show
// mild Day LST (roughly 0-20 C) and cooler Night LST (often below 5-10 C),
// though this varies a lot by lake elevation. Anything like -100 or +80 C
// means a masking issue — stop and check before continuing.

// ============================================================
// STOP HERE until the test above looks correct.
// Only after confirming, run the sections below.
// ============================================================

// ------------------------------------------------------------
// STEP 7: Build the list of Year-Month pairs
// 2015-01 through 2024-12 — 10 full years, 12 months each,
// matching the GPM dataset (120 months per lake).
// ------------------------------------------------------------
var allYearMonths = [];

for (var y = 2015; y <= 2024; y++) {
  for (var m = 1; m <= 12; m++) {
    allYearMonths.push({year: y, month: m});
  }
}

print('Total months to process:', allYearMonths.length); // should be 120

// ------------------------------------------------------------
// STEP 8: Full extraction — ALL 494 lakes x ALL months
// ------------------------------------------------------------
function buildMonthlyTable(ymArray) {
  var ymList = ee.List(ymArray);
  return ee.FeatureCollection(ymList.map(function(ym) {
    ym = ee.Dictionary(ym);
    var y = ee.Number(ym.get('year'));
    var m = ee.Number(ym.get('month'));
    var img = monthlyLST(y, m);

    var extracted = img.reduceRegions({
      collection: buffers,
      reducer: ee.Reducer.mean(),
      scale: 1000,   // MODIS LST native resolution
      tileScale: 4
    });

    return extracted.map(function(f) {
      var dateStr = ee.String(y.format()).cat('-').cat(m.format('%02d'));
      return f.set({
        'Date': dateStr,
        'Year': y,
        'Month': m,
        'LST_Day_C': f.get('LST_Day_C_mean'),
        'LST_Night_C': f.get('LST_Night_C_mean'),
        'LST_Scan_Count': img.get('image_count')
      });
    });
  })).flatten();
}

// ------------------------------------------------------------
// STEP 9: Split by year range into 2 batches (time dimension only)
// ------------------------------------------------------------

// --- Batch A: 2015-2019 (5 years x 12 = 60 months) ---
var ymBatchA = allYearMonths.filter(function(ym) {
  return ym.year >= 2015 && ym.year <= 2019;
});
var tableA = buildMonthlyTable(ymBatchA);

Export.table.toDrive({
  collection: tableA,
  description: 'MODIS_LST_Monthly_2015_2019',
  folder: 'GLOF_MODIS_LST_Output',
  fileNamePrefix: 'MODIS_LST_Monthly_AllLakes_2015_2019',
  fileFormat: 'CSV',
  selectors: ['GL_ID', 'Date', 'Year', 'Month', 'LST_Day_C', 'LST_Night_C', 'LST_Scan_Count']
});

// --- Batch B: 2020-2024 (5 years x 12 = 60 months) ---
var ymBatchB = allYearMonths.filter(function(ym) {
  return ym.year >= 2020 && ym.year <= 2024;
});
var tableB = buildMonthlyTable(ymBatchB);

Export.table.toDrive({
  collection: tableB,
  description: 'MODIS_LST_Monthly_2020_2024',
  folder: 'GLOF_MODIS_LST_Output',
  fileNamePrefix: 'MODIS_LST_Monthly_AllLakes_2020_2024',
  fileFormat: 'CSV',
  selectors: ['GL_ID', 'Date', 'Year', 'Month', 'LST_Day_C', 'LST_Night_C', 'LST_Scan_Count']
});

// ============================================================
// NOTES
// - LST_Day_C / LST_Night_C = mean monthly land surface temperature,
//   in degrees Celsius, averaged from valid 8-day MOD11A2 composites.
// - LST_Scan_Count = how many 8-day composites were available and
//   contributed to that month (max is usually 3-4 per month). A low
//   count means fewer 8-day windows had valid (cloud-free) coverage.
// - Persistent cloud cover over high mountain lakes can mean some
//   lake-months have NO valid LST pixels at all -> those rows may
//   come back empty/null. Check for this after export (see the
//   Python quality-check script pattern used for GPM).
// - After both CSVs land in Drive, concatenate them in Python, then
//   merge with GPM/ERA5/S1/S2 data on GL_ID + Year + Month.
// - Go to the "Tasks" tab in the GEE Code Editor and click "Run"
//   next to each export task — they do not start automatically.
// ============================================================
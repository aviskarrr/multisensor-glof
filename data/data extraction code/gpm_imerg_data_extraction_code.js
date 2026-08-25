// ============================================================
// GPM_Monthly.js
// GPM IMERG V07 -> Monthly Precipitation per Lake (5 km buffer)
// Project: major-project-505914
// Task owner: GPM only (do not touch ERA5 / S1 / S2 scripts)
// ============================================================

// ------------------------------------------------------------
// STEP 1: Load lake inventory
// ------------------------------------------------------------
var lakes = ee.FeatureCollection(
  'projects/major-project-505914/assets/lake_inventory_5districts'
);

print('Total lakes:', lakes.size()); // should print 494

// ------------------------------------------------------------
// CHECK: Is "Id" unique per lake? (run this once, check Console)
// distinctIdCount should equal totalLakeCount. If it's smaller,
// "Id" has duplicates and is NOT safe to merge on with friends' CSVs.
// ------------------------------------------------------------
var totalLakeCount = lakes.size();
var distinctIdCount = lakes.distinct('Id').size();
print('Total lakes:', totalLakeCount);
print('Distinct Id count:', distinctIdCount);
print('Id is unique?', totalLakeCount.eq(distinctIdCount));

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

// Quick visual check (optional, comment out for large exports if slow)
Map.centerObject(lakes, 8);
Map.addLayer(lakes, {color: 'blue'}, 'Lakes');
Map.addLayer(centroids, {color: 'red'}, 'Centroids');
Map.addLayer(buffers, {color: 'orange'}, 'Buffers');

// ------------------------------------------------------------
// STEP 4: Load GPM IMERG V07 (30-min precipitation RATE, mm/hr)
// ------------------------------------------------------------
var gpm = ee.ImageCollection('NASA/GPM_L3/IMERG_V07')
  .select('precipitation'); // only the rate band; other bands would corrupt a sum

// ------------------------------------------------------------
// STEP 5: Function to build ONE monthly accumulated precipitation image
// (sums only the intervals that actually exist -> gap-safe)
// ------------------------------------------------------------
function monthlyPrecip(year, month) {
  year = ee.Number(year);
  month = ee.Number(month);
  var start = ee.Date.fromYMD(year, month, 1);
  var end = start.advance(1, 'month');

  var monthCol = gpm.filterDate(start, end);

  var summed = monthCol
    .map(function(img) {
      // rate (mm/hr) x 0.5 hr = amount for that interval (mm)
      return img.updateMask(img.gte(0)).multiply(0.5);
    })
    .sum()
    .rename('precip_mm');

  return summed.set({
    'year': year,
    'month': month,
    'system:time_start': start.millis(),
    'image_count': monthCol.size() // how many 30-min scans went into this month (QA)
  });
}

// ------------------------------------------------------------
// STEP 6: TEST — single month (July 2024), single lake
// Run this first. Check the Console before doing anything else.
// ------------------------------------------------------------
var testImage = monthlyPrecip(2024, 7);
print('Test image (July 2024) info:', testImage);
print('Number of 30-min scans used in July 2024:', testImage.get('image_count'));

var firstLake = ee.Feature(buffers.first());

var testResult = testImage.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: firstLake.geometry(),
  scale: 11132,
  tileScale: 4
});

print('Test result — July 2024, first lake (mm):', testResult);
// Sanity check: for Khumbu/Annapurna monsoon month, expect roughly 200-600 mm.
// If the number is wildly outside that range, stop and check band/mask before continuing.

// ============================================================
// STOP HERE until the test above looks correct.
// Only after confirming, run the sections below.
// ============================================================

// ------------------------------------------------------------
// STEP 7: Build the list of Year-Month pairs
// 2015-01 through 2024-12 — 10 full years, 12 months each,
// so every lake gets exactly 120 rows (10 x 12).
// Built in plain client-side JS (not ee.List) — simpler and avoids
// ee.Filter issues when we split into batches below.
// ------------------------------------------------------------
var allYearMonths = []; // plain JS array of {year, month} objects

for (var y = 2015; y <= 2024; y++) {
  for (var m = 1; m <= 12; m++) {
    allYearMonths.push({year: y, month: m});
  }
}

print('Total months to process:', allYearMonths.length); // should be 120

// ------------------------------------------------------------
// STEP 8: Full extraction — ALL 494 lakes x ALL months
// Uses reduceRegions (batch over all lakes per month) — do NOT
// loop lake-by-lake, that's what actually causes GEE slowness.
// ------------------------------------------------------------
function buildMonthlyTable(ymArray) {
  var ymList = ee.List(ymArray); // convert plain JS array -> ee.List of ee.Dictionary
  return ee.FeatureCollection(ymList.map(function(ym) {
    ym = ee.Dictionary(ym);
    var y = ee.Number(ym.get('year'));
    var m = ee.Number(ym.get('month'));
    var img = monthlyPrecip(y, m);

    var extracted = img.reduceRegions({
      collection: buffers,
      reducer: ee.Reducer.mean(),
      scale: 11132,   // native GPM resolution (~0.1 deg) in meters
      tileScale: 4
    });

    return extracted.map(function(f) {
      var dateStr = ee.String(y.format()).cat('-').cat(m.format('%02d'));
      return f.set({
        'Date': dateStr,
        'Year': y,
        'Month': m,
        'GPM_Precipitation_mm': f.get('mean'),
        'GPM_Scan_Count': img.get('image_count')
      });
    });
  })).flatten();
}

// ------------------------------------------------------------
// STEP 9: Split by year range into 2 batches (time dimension only,
// NOT lake count — all 494 lakes are always included together).
// Run ONE export at a time from the Tasks tab, or queue both.
// ------------------------------------------------------------

// --- Batch A: 2015-2019 (5 years x 12 = 60 months) ---
var ymBatchA = allYearMonths.filter(function(ym) {
  return ym.year >= 2015 && ym.year <= 2019;
});
var tableA = buildMonthlyTable(ymBatchA);

Export.table.toDrive({
  collection: tableA,
  description: 'GPM_Monthly_2015_2019',
  folder: 'GLOF_GPM_Output',
  fileNamePrefix: 'GPM_Monthly_AllLakes_2015_2019',
  fileFormat: 'CSV',
  selectors: ['Id', 'Date', 'Year', 'Month', 'GPM_Precipitation_mm', 'GPM_Scan_Count']
});

// --- Batch B: 2020-2024 (5 years x 12 = 60 months) ---
var ymBatchB = allYearMonths.filter(function(ym) {
  return ym.year >= 2020 && ym.year <= 2024;
});
var tableB = buildMonthlyTable(ymBatchB);

Export.table.toDrive({
  collection: tableB,
  description: 'GPM_Monthly_2020_2024',
  folder: 'GLOF_GPM_Output',
  fileNamePrefix: 'GPM_Monthly_AllLakes_2020_2024',
  fileFormat: 'CSV',
  selectors: ['Id', 'Date', 'Year', 'Month', 'GPM_Precipitation_mm', 'GPM_Scan_Count']
});

// ============================================================
// NOTES
// - GPM_Precipitation_mm = total monthly accumulated precipitation,
//   in millimeters (mm), summed from 30-min interval amounts.
// - GPM_Scan_Count = number of 30-min scans available that month
//   (out of a max of ~1488-1440 depending on month length). Use
//   this for QA — a low count vs. expected means a gappy month.
// - Each lake will have exactly 120 rows total (60 from each batch)
//   once both CSVs are combined: 10 years x 12 months, 2015-2024.
// - After both CSVs land in Drive, concatenate them in Python
//   (pandas.concat) before merging with your teammates' data on
//   Id + Year + Month.
// - Go to the "Tasks" tab in the GEE Code Editor and click "Run"
//   next to each export task — they do not start automatically.
// ============================================================
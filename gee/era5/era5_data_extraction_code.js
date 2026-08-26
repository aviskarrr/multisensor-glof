// ============================================================
// ERA5-LAND MONTHLY TEMPERATURE — CLEAN VERSION
// ============================================================
// Project: Multi-Sensor Spatio-Temporal ML Framework for
//          Glacial Lake Hazard Assessment in Nepal
//
// PERIOD: 2015-01 to 2025-12 (132 months)
// OUTPUT FORMAT:
//   GL_ID      = From your asset (e.g., "GL_LAKE001")
//   date       = "YYYY-MM"   e.g. "2015-01"
//   month      = integer 1-12 (not zero-padded)
//   year       = integer      e.g. 2015
//   ERA5_temp_K = Temperature in Kelvin
//   ERA5_temp_C = Temperature in Celsius
// ============================================================

// ============================================================
// 0. SETTINGS
// ============================================================

var BATCH_SIZE = 50;   // Process 50 lakes per batch
var START_YEAR = 2015;
var END_YEAR = 2025;

// ============================================================
// 1. LOAD FULL LAKE INVENTORY
// ============================================================

var allLakes = ee.FeatureCollection(
  'projects/minor-project-487610/assets/major/lake_inventory_5districts'
);

// Check property names to verify GL_ID exists
var firstFeature = allLakes.first();
var propertyNames = firstFeature.propertyNames();
print('Property names in your asset:', propertyNames);

// Check if GL_ID property exists
var hasGLID = propertyNames.contains('GL_ID');
print('Does GL_ID property exist?', hasGLID);

// Get total count and calculate number of batches
var TOTAL_LAKES = allLakes.size().getInfo();
var NUM_BATCHES = Math.ceil(TOTAL_LAKES / BATCH_SIZE);

print('Total lakes in inventory:', TOTAL_LAKES);
print('Batches to be created (' + BATCH_SIZE + ' lakes each):', NUM_BATCHES);

// Get study region bounds
var studyGeometry = allLakes.geometry().bounds();

// ============================================================
// 2. TIME SETTINGS
// ============================================================

var startDate = ee.Date.fromYMD(START_YEAR, 1, 1);
var endDate = ee.Date.fromYMD(END_YEAR + 1, 1, 1);

// Create list of all months (132 months from 2015-01 to 2025-12)
var monthStarts = ee.List.sequence(0, 131).map(function(n) {
  return startDate.advance(ee.Number(n), 'month');
});

// ============================================================
// 3. LOAD ERA5-LAND MONTHLY DATA
// ============================================================

var era5Monthly = ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')
  .filterBounds(studyGeometry)
  .filterDate(startDate, endDate)
  .select('temperature_2m');

print('ERA5-LAND images available:', era5Monthly.size());

// ============================================================
// 4. TEST FUNCTION - Check if data extraction works
// ============================================================

function testDataExtraction() {
  print('--- Running test extraction ---');
  
  // Take first 5 lakes for testing
  var testLakes = allLakes.limit(5);
  var testCentroids = testLakes.map(function(feature) {
    return ee.Feature(feature.geometry().centroid(1), {
      'GL_ID': feature.get('GL_ID')
    });
  });
  
  // Print test GL_IDs to verify
  var testGLIDs = testCentroids.aggregate_array('GL_ID');
  print('Test GL_IDs from asset:', testGLIDs);
  
  // Get first month image
  var testImage = era5Monthly.first();
  
  // Sample temperature at centroid points
  var testSample = testImage.sampleRegions({
    collection: testCentroids,
    properties: ['GL_ID'],
    scale: 11132,
    tileScale: 4,
    geometries: false
  });
  
  print('Test sample (should show temperature values):', testSample);
  
  // Print first few values to verify
  var values = testSample.aggregate_array('temperature_2m');
  print('Temperature values (K):', values);
  print('Number of samples:', testSample.size());
  
  return testSample;
}

// Uncomment the line below to run the test
// var testResult = testDataExtraction();

// ============================================================
// 5. PER-BATCH PROCESSING FUNCTION (CLEAN VERSION)
// ============================================================

function processBatch(startIndex, batchSize, batchLabel) {

  // Get current batch of lakes
  var batch = ee.FeatureCollection(allLakes.toList(batchSize, startIndex));
  
  // Create centroids with only GL_ID
  var batchCentroids = batch.map(function(feature) {
    return ee.Feature(feature.geometry().centroid(1), {
      'GL_ID': feature.get('GL_ID')
    });
  });

  // Process all months for this batch
  var era5Table = ee.FeatureCollection(
    monthStarts.map(function(dateObject) {
      
      var date = ee.Date(dateObject);
      var nextDate = date.advance(1, 'month');
      
      // Get the image for this month
      var monthImageCollection = era5Monthly.filterDate(date, nextDate);
      var hasImage = monthImageCollection.size().gt(0);
      
      // Use the image if exists, otherwise create a dummy
      var monthImage = ee.Image(ee.Algorithms.If(
        hasImage,
        monthImageCollection.first(),
        ee.Image.constant(0).rename('temperature_2m')
      ));
      
      // Sample temperature at centroid points
      var sampled = monthImage.sampleRegions({
        collection: batchCentroids,
        properties: ['GL_ID'],
        scale: 11132,
        tileScale: 4,
        geometries: false
      });
      
      // Add date information
      return sampled.map(function(feature) {
        var tempK = feature.get('temperature_2m');
        var dateStr = date.format('YYYY-MM');
        var year = date.get('year');
        var month = date.get('month');
        
        // Convert Kelvin to Celsius
        var tempC = ee.Algorithms.If(
          ee.Algorithms.IsEqual(tempK, null),
          null,
          ee.Number(tempK).subtract(273.15)
        );
        
        return ee.Feature(null, {
          'GL_ID': feature.get('GL_ID'),
          'date': dateStr,
          'year': year,
          'month': month,
          'ERA5_temp_K': tempK,
          'ERA5_temp_C': tempC
        });
      });
      
    })
  ).flatten();

  // Export to CSV - CLEAN OUTPUT WITH ONLY ESSENTIAL FIELDS
  Export.table.toDrive({
    collection: era5Table,
    description: 'ERA5_' + batchLabel,
    fileNamePrefix: 'era5_' + batchLabel,
    fileFormat: 'CSV',
    selectors: [
      'GL_ID',
      'date',
      'year',
      'month',
      'ERA5_temp_K',
      'ERA5_temp_C'
    ]
  });

  print('✅ Registered task: ERA5_' + batchLabel + 
    ' (lakes ' + startIndex + ' to ' + (startIndex + batchSize - 1) + ')');
}

// ============================================================
// 6. LOOP OVER ALL BATCHES
// ============================================================

for (var i = 0; i < NUM_BATCHES; i++) {
  var startIndex = i * BATCH_SIZE;
  var batchLabel = 'batch_' + ((i + 1) < 10 ? '0' : '') + (i + 1);
  processBatch(startIndex, BATCH_SIZE, batchLabel);
}

print('✅ All ' + NUM_BATCHES + ' batch tasks registered!');
print('📋 Go to the Tasks tab (top-right) and click Run on each ERA5_batch_NN task.');
print('💡 Tip: You can run multiple tasks in parallel by clicking Run on each one.');
print('📌 Output columns: GL_ID, date, year, month, ERA5_temp_K, ERA5_temp_C');

// ============================================================
// END
// ============================================================
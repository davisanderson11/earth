/********************************************
 * point-init.js
 ********************************************/

// 1° steps across [-90..90, -180..180]
const LAND_DATA_URL  = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";
const LAKES_DATA_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson";
const RIVERS_DATA_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson";

const LAT_START = -90, LAT_END = 90;
const LON_START = -180, LON_END = 180;
const DEG_STEP = 1;
const CHUNK_SIZE_LAT = 5; // process 5 lat rows per chunk for responsiveness

// Dictionary of "lat,lon" => speed
window.speedMap = {};
// For debugging, a FeatureCollection of all land points
window.speedMapFC = turf.featureCollection([]);

function updateSidebarMessage(msg) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebar-content');
  if (content) {
    content.innerHTML = msg;
    sidebar.style.display = 'block';
  }
}

/**
 * Renders the dictionary points as blue dots (so we can confirm we have them).
 */
function renderSpeedMap() {
  if (!map.getSource('speedMapSource')) {
    map.addSource('speedMapSource', {
      type: 'geojson',
      data: window.speedMapFC
    });
    map.addLayer({
      id: 'speedMapLayer',
      type: 'circle',
      source: 'speedMapSource',
      paint: {
        'circle-color': 'blue',
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1.5,
          2, 1.5,
          3, 2,
          6, 3
        ]
      }
    });
  } else {
    map.getSource('speedMapSource').setData(window.speedMapFC);
  }

  // Fit to the bounding box of all points
  const bbox = turf.bbox(window.speedMapFC);
  map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 20 });
}

/**
 * Creates the land dictionary, factoring in lakes and rivers:
 * - If on land, speed is normally [0.3..0.8].
 * - If also in lake polygon or "on" the rivers centerline, speed is "very high" (here, 5).
 *   (We define “on” for rivers as booleanPointOnLine, but you could do a distance check if you like.)
 */
async function initSpeedMap() {
  try {
    updateSidebarMessage("Loading land, lakes, and rivers data...");

    // Fetch all data in parallel
    const [landResp, lakesResp, riversResp] = await Promise.all([
      fetch(LAND_DATA_URL),
      fetch(LAKES_DATA_URL),
      fetch(RIVERS_DATA_URL)
    ]);
    const [landData, lakesData, riversData] = await Promise.all([
      landResp.json(),
      lakesResp.json(),
      riversResp.json()
    ]);

    // We'll process lat rows in chunks
    let currentLat = LAT_START;

    function processChunk() {
      const newFeatures = [];

      for (let i = 0; i < CHUNK_SIZE_LAT; i++) {
        if (currentLat > LAT_END) break;

        updateSidebarMessage(`Building 1° land grid... lat=${currentLat}`);

        for (let lon = LON_START; lon <= LON_END; lon += DEG_STEP) {
          const pt = turf.point([lon, currentLat]);

          // 1) Check if point is on land
          let isOnLand = false;
          for (const feat of landData.features) {
            if (turf.booleanPointInPolygon(pt, feat)) {
              isOnLand = true;
              break;
            }
          }
          if (!isOnLand) continue; // skip water

          // 2) Check if point is in a lake polygon
          let inLake = false;
          for (const lakeFeat of lakesData.features) {
            if (turf.booleanPointInPolygon(pt, lakeFeat)) {
              inLake = true;
              break;
            }
          }

          // 3) Check if point is on (or extremely close to) a river centerline
          // We'll do a simplistic booleanPointOnLine approach, but you might want a
          // distance-based approach if the lines are very thin.
          let onRiver = false;
          for (const riverFeat of riversData.features) {
            // If geometry is linestring or multilinestring, we can test
            if (turf.booleanPointOnLine && 
                (riverFeat.geometry.type === "LineString" || riverFeat.geometry.type === "MultiLineString")) {
              const result = turf.booleanPointOnLine(pt, riverFeat);
              if (result) {
                onRiver = true;
                break;
              }
            }
          }

          // 4) Decide the speed
          let speedVal = Math.random() * 0.05 + 0.03; // default [0.3..0.8]
          if (inLake || onRiver) {
            speedVal = 5; // "very high" speed
          }

          // 5) Store in dictionary
          const key = `${currentLat},${lon}`;
          window.speedMap[key] = speedVal;

          // For debugging, add to FeatureCollection
          pt.properties = { speed: speedVal };
          newFeatures.push(pt);
        }
        currentLat += DEG_STEP;
      }

      window.speedMapFC.features.push(...newFeatures);

      // Keep going in chunks until lat > LAT_END
      if (currentLat <= LAT_END) {
        requestAnimationFrame(processChunk);
      } else {
        updateSidebarMessage(`Done. Built ${Object.keys(window.speedMap).length} land points. Rendering...`);
        renderSpeedMap();
        updateSidebarMessage("All done. Ready to set a capital!");
      }
    }

    // Start chunk-based creation
    processChunk();

  } catch (err) {
    console.error("Error building speedMap with rivers/lakes:", err);
    updateSidebarMessage("Failed to build speed map: see console.");
  }
}

// Once map loads, begin building the dictionary
map.on('load', () => {
  initSpeedMap();
});

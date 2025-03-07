/********************************************
 * point-init.js
 ********************************************/

const LAND_DATA_URL  = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";
const LAKES_DATA_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson";
const RIVERS_DATA_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson";

const LAT_START = -90, LAT_END = 90;
const LON_START = -180, LON_END = 180;
const DEG_STEP = 0.2;
const CHUNK_SIZE_LAT = 1; // process rows in chunks for responsiveness

// Our global dictionary of "lat,lon" => speed
window.speedMap = {};
// A FeatureCollection of all land points (for debugging)
window.speedMapFC = turf.featureCollection([]);

/** Basic helper to update the sidebar message. */
function updateSidebarMessage(msg) {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('sidebar-content');
  if (content) {
    content.innerHTML = msg;
    sidebar.style.display = 'block';
  }
}

/**
 * Renders the dictionary points (speedMapFC) as blue dots, so we can confirm we have them.
 * Now clustering is enabled.
 */
function renderSpeedMap() {
  if (!map.getSource('speedMapSource')) {
    map.addSource('speedMapSource', {
      type: 'geojson',
      data: window.speedMapFC,
      cluster: true,         // clustering enabled
      clusterRadius: 50      // adjust radius (in pixels) as needed
    });
    map.addLayer({
      id: 'speedMapLayer',
      type: 'circle',
      source: 'speedMapSource',
      paint: {
        'circle-color': [
          'interpolate',
          ['linear'],
          ['get', 'speed'],
          0, '#0000FF',
          0.08, '#00FF00',   // Low speeds are blue
          10, '#FF0000'    // High speeds are red
        ],
        'circle-opacity': 0.7,
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

  // Fit to bounding box of all points
  const bbox = turf.bbox(window.speedMapFC);
  map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 20 });
}

/**
 * Try to fetch an existing "landData.json" from your server/folder.
 * If found, we load it into speedMap / speedMapFC and return true.
 * If not, we return false, so we know to build it ourselves.
 */
async function loadExistingLandGrid() {
  try {
    // Fetch from ../assets/landData.json
    const resp = await fetch("../assets/landData.json");
    if (!resp.ok) throw new Error("No existing landData.json file found.");
    const data = await resp.json();
    // 'data' should be a FeatureCollection with .features
    if (!data || !data.features) throw new Error("Invalid landData.json format.");
    // Populate speedMap and speedMapFC
    window.speedMapFC = data; // the entire FeatureCollection
    window.speedMap = {};
    // Build our dictionary from those features
    for (const feat of data.features) {
      const [lon, lat] = feat.geometry.coordinates;
      const latInt = Math.round(lat);
      const lonInt = Math.round(lon);
      const key = `${latInt},${lonInt}`;
      // Use the speed we stored
      const speedVal = feat.properties.speed;
      window.speedMap[key] = speedVal;
    }
    console.log("Loaded land grid from file. #features=", data.features.length);
    return true;
  } catch (err) {
    console.log("No existing landData.json", err);
    return false;
  }
}

/**
 * Once we've fully built speedMap and speedMapFC, let's auto-download them
 * as 'landData.json' so next time we can load it instead of building.
 */
function autoDownloadLandGrid() {
  try {
    const jsonStr = JSON.stringify(window.speedMapFC);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const link = document.createElement("a");
    // Download as landData.json
    link.download = "landData.json";
    link.href = URL.createObjectURL(blob);
    link.click();
  } catch (err) {
    console.warn("Download failed:", err);
  }
}

/**
 * Creates the land dictionary in a chunked manner:
 * - If on land, we assign speed [0.3..0.8].
 * - If in lake or on a river, speed = 5.
 * (This is your original logic; unchanged except for auto-download.)
 */
async function initSpeedMap() {
  try {
    updateSidebarMessage("Loading geographic data...");

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

    // Process lat rows in chunks
    let currentLat = LAT_START;

    async function processChunk() {
      const newFeatures = [];

      for (let i = 0; i < CHUNK_SIZE_LAT; i++) {
        if (currentLat > LAT_END) break;

        updateSidebarMessage(`Building grid. lat=${currentLat}`);

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
          let onRiver = false;
          for (const riverFeat of riversData.features) {
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
          let speedVal = Math.random() * 0.05 + 0.03; // default ~[0.03..0.08]
          if (inLake || onRiver) {
            speedVal = 50; // "very high" speed
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

      // Continue in chunks until finished
      if (currentLat <= LAT_END) {
        requestAnimationFrame(processChunk);
      } else {
        updateSidebarMessage(`Built ${Object.keys(window.speedMap).length} land points. Rendering...`);
        renderSpeedMap();
        autoDownloadLandGrid();
        updateSidebarMessage("Downloaded as landData.json");
      }
    }

    processChunk();

  } catch (err) {
    console.error("Error building speedMap with rivers/lakes:", err);
    updateSidebarMessage("Failed to build speed map: see console.");
  }
}

/**
 * On map load:
 * 1) Try loading existing landData.json,
 *    - If found, skip building and use that data.
 *    - If not, run initSpeedMap.
 */
map.on('load', async () => {
  const loaded = await loadExistingLandGrid();
  if (loaded) {
    renderSpeedMap();
  } else {
    initSpeedMap();
  }
});

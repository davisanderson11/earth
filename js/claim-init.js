/** Moves a Turf point sub-degree using equirectangular math. */
function fastDestination(point, distanceKm, bearingDeg) {
  const [lng, lat] = point.geometry.coordinates;
  const rad = Math.PI / 180;
  const bearing = bearingDeg * rad;
  // ~111 km per 1° lat
  const deltaLat = (distanceKm / 111) * Math.cos(bearing);
  // ~111 * cos(lat) for 1° lon
  const deltaLng = (distanceKm / (111 * Math.cos(lat * rad))) * Math.sin(bearing);
  return turf.point([lng + deltaLng, lat + deltaLat]);
}

/** Mapping from elevation categories to speed values. */
const elevationToSpeed = {
  "min": 0,
  "low": 0.03,
  "medLow": 0.05,
  "med": 0.07,
  "medHigh": 0.09,
  "high": 0.11,
  "max": 0.15
};

/**
 * Look up the speed value using the rendered elevation-fill layer.
 * Given a Turf point, convert its coordinates to screen pixels and query
 * the rendered features from the "elevation-fill" layer.
 */
function getSpeedFromDictionary(point) {
  const coords = point.geometry.coordinates;
  const pixel = map.project(coords);
  const features = map.queryRenderedFeatures(pixel, { layers: ["elevation-fill"] });
  if (features && features.length > 0) {
    const heightCategory = features[0].properties.height;
    return elevationToSpeed[heightCategory] || 0;
  }
  return 0;
}

/**
 * Helper: Returns true if the given Turf point is on land by querying the "land-fill" layer.
 */
function isOnLand(point) {
  const pixel = map.project(point.geometry.coordinates);
  const features = map.queryRenderedFeatures(pixel, { layers: ["land-fill"] });
  return features && features.length > 0;
}

/**
 * Returns a new point that linearly interpolates between p1 and p2 by fraction t in [0..1].
 */
function interpolatePoints(p1, p2, t) {
  const [lng1, lat1] = p1.geometry.coordinates;
  const [lng2, lat2] = p2.geometry.coordinates;
  const lng = lng1 + (lng2 - lng1) * t;
  const lat = lat1 + (lat2 - lat1) * t;
  return turf.point([lng, lat]);
}

/**
 * Computes a territory polygon starting from a given capital point.
 * For each degree (0 to 359), this async function updates the sidebar with progress.
 * It then extends the ray by repeatedly stepping along the current bearing until
 * the next point would be off land (as determined by isOnLand).
 */
async function computeTerritoryPolygon(capitalPoint) {
  const initialPower = 50;
  const kmStep = 0.1;
  const angleStep = 5;
  const endpoints = [];
  
  for (let angle = 0; angle < 360; angle += angleStep) {
    // Update sidebar with current progress.
    document.getElementById("sidebar-content").innerHTML = `Computing territory ${angle}/360`;
    
    let rayPower = initialPower;
    let currentPos = capitalPoint;
    
    // Continue stepping while we have power and remain on land.
    while (rayPower > 0 && isOnLand(currentPos)) {
      let nextPos = fastDestination(currentPos, kmStep, angle);
      // If the next point is off land, then we've reached water.
      if (!isOnLand(nextPos)) {
        break;
      }
      // Otherwise, decrement our remaining power based on the speed at the current point.
      const speed = getSpeedFromDictionary(currentPos);
      rayPower -= speed;
      currentPos = nextPos;
    }
    endpoints.push(currentPos.geometry.coordinates);
    // Yield control to allow UI updates.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  endpoints.push(endpoints[0]);
  return turf.polygon([endpoints]);
}

/** Fetch the Natural Earth land GeoJSON used for claim splitting. */
async function fetchLandGeoJSON() {
  const url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";
  const resp = await fetch(url);
  return resp.json();
}

/**
 * Splits the land feature collection by the claim polygon,
 * marking claimed areas.
 */
function splitLandByClaim(landFC, claimPoly) {
  const outFeatures = [];
  for (const landFeat of landFC.features) {
    const intersection = turf.intersect(landFeat, claimPoly);
    if (intersection) {
      intersection.properties = { ...intersection.properties, claimed: true };
      outFeatures.push(intersection);
    }
    const leftover = turf.difference(landFeat, claimPoly);
    if (leftover) {
      leftover.properties = { ...leftover.properties, claimed: false };
      outFeatures.push(leftover);
    }
  }
  return turf.featureCollection(outFeatures);
}

/**
 * Applies the claim by updating the "land" source data and setting fill colors.
 */
function applyClaimToLandSource(splitFC) {
  map.getSource("land").setData(splitFC);
  map.setPaintProperty("land-fill", "fill-color", [
    "case",
    ["==", ["get", "claimed"], true],
    "pink",
    "#d2c290"
  ]);
}

/**
 * Creates a button to set the capital and compute the territory polygon.
 */
function createSetCapitalButton() {
  const btn = document.createElement("button");
  btn.id = "setCapitalButton";
  btn.textContent = "Set Capital [Debug]";
  btn.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 999;
    padding: 8px 12px;
    font-size: 14px;
    cursor: pointer;
  `;
  document.body.appendChild(btn);
  
  btn.addEventListener("click", () => {
    map.once("click", async (e) => {
      const landCheck = map.queryRenderedFeatures(e.point, { layers: ["land-fill"] });
      if (!landCheck.length) {
        alert("Please click on land!");
        btn.click();
        return;
      }
      document.getElementById("sidebar-content").innerHTML = "Computing territory...<br/>";
      document.getElementById("sidebar").style.display = "block";
      
      const capital = turf.point([e.lngLat.lng, e.lngLat.lat]);
      const rawPolygon = await computeTerritoryPolygon(capital);
      const landFC = await fetchLandGeoJSON();
      const splitFC = splitLandByClaim(landFC, rawPolygon);
      applyClaimToLandSource(splitFC);
    });
  });
}

// Initialize the Set Capital button.
createSetCapitalButton();

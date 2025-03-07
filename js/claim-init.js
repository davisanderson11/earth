// Move turf.js point to intermediary
function fastDestination(point, distanceKm, bearingDeg) {
  const [lng, lat] = point.geometry.coordinates;
  const rad = Math.PI / 180;
  const bearing = bearingDeg * rad;
  // 111 km per 1 deg lat (TODO: change this)
  const deltaLat = (distanceKm / 111) * Math.cos(bearing);
  // 111 * cos(lat) for 1 deg lng
  const deltaLng = (distanceKm / (111 * Math.cos(lat * rad))) * Math.sin(bearing);
  return turf.point([lng + deltaLng, lat + deltaLat]);
}

// Map height to speed
const elevationToSpeed = {
  "min": 0,
  "low": 0.03,
  "medLow": 0.05,
  "med": 0.07,
  "medHigh": 0.09,
  "high": 0.11,
  "max": 0.15
};

// Look up speed via elevation-fill
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

// Returns true if point is on land
function isOnLand(point) {
  const pixel = map.project(point.geometry.coordinates);
  const features = map.queryRenderedFeatures(pixel, { layers: ["land-fill"] });
  return features && features.length > 0;
}

// Self explanatory
function interpolatePoints(p1, p2, t) {
  const [lng1, lat1] = p1.geometry.coordinates;
  const [lng2, lat2] = p2.geometry.coordinates;
  const lng = lng1 + (lng2 - lng1) * t;
  const lat = lat1 + (lat2 - lat1) * t;
  return turf.point([lng, lat]);
}

// Raycast from centerpoint and set endpoint of rays to points on polygon
async function computeTerritoryPolygon(capitalPoint) {
  const initialPower = 50;
  const kmStep = 0.1;
  const angleStep = 5;
  const endpoints = [];
  
  for (let angle = 0; angle < 360; angle += angleStep) {
    // Update sidebar with current progress
    document.getElementById("sidebar-content").innerHTML = `Computing territory ${angle}/360`;
    
    let rayPower = initialPower;
    let currentPos = capitalPoint;
    
    // Continue stepping while having power and on land
    while (rayPower > 0 && isOnLand(currentPos)) {
      let nextPos = fastDestination(currentPos, kmStep, angle);
      // If the next point is off land, it is water
      if (!isOnLand(nextPos)) {
        break;
      }
      // Decrement power by speed at current point
      const speed = getSpeedFromDictionary(currentPos);
      rayPower -= speed;
      currentPos = nextPos;
    }
    endpoints.push(currentPos.geometry.coordinates);
    // Yield control to allow UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  endpoints.push(endpoints[0]);
  return turf.polygon([endpoints]);
}

// Fetch the land GeoJSON
async function fetchLandGeoJSON() {
  const url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";
  const resp = await fetch(url);
  return resp.json();
}

// Separate claim from main polygon
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

// Apply claim
function applyClaimToLandSource(splitFC) {
  map.getSource("land").setData(splitFC);
  map.setPaintProperty("land-fill", "fill-color", [
    "case",
    ["==", ["get", "claimed"], true],
    "red",
    "#d2c290"
  ]);
}

// Compute territory polygon
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

// Initialize debug set capital button
createSetCapitalButton();

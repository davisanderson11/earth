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

/**
 * Look up speed from the nearest integer lat/lon in speedMap. Returns 0 if none found.
 */
function getSpeedFromDictionary(point) {
  const [lng, lat] = point.geometry.coordinates;
  const latInt = Math.round(lat);
  const lonInt = Math.round(lng);
  const key = `${latInt},${lonInt}`;
  return window.speedMap[key] || 0;
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

function approximateCoastline(lastOnLand, offLand, maxIterations = 6) {
  let lowPt = lastOnLand;
  let highPt = offLand;

  for (let i = 0; i < maxIterations; i++) {
    const mid = interpolatePoints(lowPt, highPt, 0.5);
    const spd = getSpeedFromDictionary(mid);
    if (spd > 0) {
      // mid is on land => shift the lower bound up
      lowPt = mid;
    } else {
      // mid is ocean => shift upper bound down
      highPt = mid;
    }
  }
  return lowPt;
}

function computeTerritoryPolygon(capitalPoint) {
  const initialPower = 200;
  const kmStep = 0.1;
  const angleStep = 1;
  const endpoints = [];

  for (let angle = 0; angle < 360; angle += angleStep) {
    let rayPower = initialPower;
    let currentPos = capitalPoint;

    while (rayPower > 0) {
      const speed = getSpeedFromDictionary(currentPos);
      if (speed <= 0) {
        break;
      }

      if (rayPower > speed) {
        rayPower -= speed;
        const nextPos = fastDestination(currentPos, kmStep, angle);
        const nextSpeed = getSpeedFromDictionary(nextPos);
        if (nextSpeed <= 0) {
          const boundaryPt = approximateCoastline(currentPos, nextPos);
          endpoints.push(boundaryPt.geometry.coordinates);
          break;
        } else {
          currentPos = nextPos;
        }
      } else {
        const fraction = rayPower / speed;
        const nextPos = fastDestination(currentPos, kmStep * fraction, angle);
        const nextSpeed = getSpeedFromDictionary(nextPos);
        if (nextSpeed <= 0) {
          const boundaryPt = approximateCoastline(currentPos, nextPos);
          endpoints.push(boundaryPt.geometry.coordinates);
          break;
        } else {
          currentPos = nextPos;
        }
        rayPower = 0;
      }
    }
    if (rayPower <= 0) {
      endpoints.push(currentPos.geometry.coordinates);
    }
  }

  endpoints.push(endpoints[0]);
  return turf.polygon([endpoints]);
}

/** Fetch the same Natural Earth land GeoJSON used by "land-fill" in map-init.js. */
async function fetchLandGeoJSON() {
  const url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson";
  const resp = await fetch(url);
  return resp.json();
}

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

function applyClaimToLandSource(splitFC) {
  map.getSource("land").setData(splitFC);
  map.setPaintProperty("land-fill", "fill-color", [
    "case",
    ["==", ["get", "claimed"], true],
    "pink",
    "#d2c290"
  ]);
}

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
      const sidebarContent = document.getElementById("sidebar-content");
      sidebarContent.innerHTML = "Computing territory...";
      document.getElementById("sidebar").style.display = "block";

      const capital = turf.point([e.lngLat.lng, e.lngLat.lat]);
      const rawPolygon = computeTerritoryPolygon(capital);

      const landFC = await fetchLandGeoJSON();
      const splitFC = splitLandByClaim(landFC, rawPolygon);
      applyClaimToLandSource(splitFC);

      // Remove the grid layer and source to free memory
      if (map.getLayer('speedMapLayer')) {
        map.removeLayer('speedMapLayer');
      }
      if (map.getSource('speedMapSource')) {
        map.removeSource('speedMapSource');
      }
    });
  });
}

// Initialize the button
createSetCapitalButton();

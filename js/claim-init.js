/********************************************
 * claim-init.js
 ********************************************/

/** Approximate distance (equirectangular) in km between two coords. */
function approximateKmDistance(lng1, lat1, lng2, lat2) {
    const R = 6371;
    const rad = Math.PI / 180;
    const avgLat = ((lat1 + lat2) / 2) * rad;
    const x = (lng2 - lng1) * rad * Math.cos(avgLat) * R;
    const y = (lat2 - lat1) * rad * R;
    return Math.sqrt(x * x + y * y);
  }
  
  /** Moves a point sub-degree using equirectangular math. */
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
   * Look up speed from the nearest integer lat/lon in speedMap. 0 if none found.
   */
  function getSpeedFromDictionary(point) {
    const [lng, lat] = point.geometry.coordinates;
    // round to nearest integer
    const latInt = Math.round(lat);
    const lonInt = Math.round(lng);
  
    const key = `${latInt},${lonInt}`;
    return window.speedMap[key] || 0;
  }
  
  /**
   * Single-pass territory claiming with partial steps.
   * 9° increments, each ray starts with power=20, we step 1 km at a time.
   * If we can't pay the speed cost, we do a partial step and end.
   */
  function computeTerritoryPolygon(capitalPoint) {
    const initialPower = 20;
    const kmStep = 1;
    const angleStep = 9;
  
    const endpoints = [];
    for (let angle = 0; angle < 360; angle += angleStep) {
      let rayPower = initialPower;
      let currentPos = capitalPoint;
  
      while (rayPower > 0) {
        const speed = getSpeedFromDictionary(currentPos);
        if (speed <= 0) {
          // off land => stop
          break;
        }
        if (rayPower > speed) {
          // full step
          rayPower -= speed;
          currentPos = fastDestination(currentPos, kmStep, angle);
        } else {
          // partial step
          const fraction = rayPower / speed;
          currentPos = fastDestination(currentPos, kmStep * fraction, angle);
          rayPower = 0;
        }
      }
      endpoints.push(currentPos.geometry.coordinates);
    }
  
    // close the polygon
    endpoints.push(endpoints[0]);
    return turf.polygon([endpoints]);
  }
  
  /**
   * Renders the claimed territory as a pink fill layer,
   * effectively recoloring the land in that region.
   */
  function renderClaimedTerritory(poly) {
    if (map.getSource('claimedTerritory')) {
      map.getSource('claimedTerritory').setData(poly);
    } else {
      map.addSource('claimedTerritory', {
        type: 'geojson',
        data: poly
      });
      map.addLayer({
        id: 'claimedTerritoryLayer',
        type: 'fill',
        source: 'claimedTerritory',
        paint: {
          'fill-color': 'pink',
          'fill-opacity': 1
        }
      });
    }
  }
  
  /**
   * Create a button to pick a capital and compute sub-degree territory.
   */
  function createSetCapitalButton() {
    const btn = document.createElement('button');
    btn.id = 'setCapitalButton';
    btn.textContent = 'Set Capital (Sub-degree)';
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
  
    btn.addEventListener('click', () => {
      map.once('click', e => {
        // must click on land
        const landCheck = map.queryRenderedFeatures(e.point, { layers: ['land-fill'] });
        if (!landCheck.length) {
          alert("Please click on land!");
          btn.click();
          return;
        }
        // place a capital marker
        new mapboxgl.Marker({ color: 'red' })
          .setLngLat(e.lngLat)
          .addTo(map);
  
        const sidebarContent = document.getElementById('sidebar-content');
        sidebarContent.innerHTML = "Computing sub-degree territory...";
        document.getElementById('sidebar').style.display = 'block';
  
        // single-pass territory
        const capital = turf.point([e.lngLat.lng, e.lngLat.lat]);
        const poly = computeTerritoryPolygon(capital);
  
        renderClaimedTerritory(poly);
        sidebarContent.innerHTML = "Done! Pink polygon shows claimed territory.";
      });
    });
  }
  
  createSetCapitalButton();
  
  const rawPolygon = computeTerritoryPolygon(capitalPoint);
  const finalPolygon = refineTerritory(
    rawPolygon,
    window.landData,      // from map-init or fetch 
    window.lakeData,      // optional
    window.riverData,     // optional
    0.1,                    // snapDeg => 1 degree
    0.1                   // riverBufferDeg => 0.1 degrees
  );
  if (finalPolygon) {
    renderClaimedTerritory(finalPolygon);
  }
  
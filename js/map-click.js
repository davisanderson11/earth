// Add a click event to display information on sidebar
map.on("click", (e) => {
  // Query features that are rendered (land, climate)
  const onLand = map.queryRenderedFeatures(e.point, { layers: ['land-fill'] });
  
  // Create a turf.js point from the click coordinates
  const point = turf.point([e.lngLat.lng, e.lngLat.lat]);

  let climateFeature = null;
  if (window.climateData && window.climateData.features) {
    for (let feature of window.climateData.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        climateFeature = feature;
        break;
      }
    }
  }
  
  // Check soil data
  let soilFeature = null;
  if (window.soilData && window.soilData.features) {
    for (let feature of window.soilData.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        soilFeature = feature;
        break;
      }
    }
  }

  // Check vegetation data
  let vegetationFeature = null;
  if (window.vegetationData && window.vegetationData.features) {
    for (let feature of window.vegetationData.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        vegetationFeature = feature;
        break;
      }
    }
  }

  // Check elevation data
  let evelationFeature = null;
  if (window.elevationData && window.elevationData.features) {
    for (let feature of window.elevationData.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        elevationFeature = feature;
        break;
      }
    }
  }

  // Only proceed if any relevant feature is detected (minus elevation)
  if (!onLand.length && !climateFeature && !soilFeature && !vegetationFeature) {
    return;
  }

  let infoHTML = "";
  
  // Show coordinates if on land
  if (onLand.length) {
    const longitude = e.lngLat.lng.toFixed(3);
    const latitude = e.lngLat.lat.toFixed(3);
    infoHTML += `<h3>${longitude}, ${latitude}</h3>`;
  }
  
  if (climateFeature) {
    const koppenCode = climateFeature.properties.CODE || "Unknown Climate";
    infoHTML += `<strong>Climate:</strong> ${koppenCode}<br>`;
  }

  if (elevationFeature){
    const height = elevationFeature.properties.height || "No Data";
    infoHTML += `<strong> Relative Height:</strong> ${height}<br>`;
  }
  
  if (soilFeature) {
    const soilType = soilFeature.properties.quality || "Unknown Soil Class";
    infoHTML += `<strong>Soil Class:</strong> ${soilType}<br>`;
  }
  
  if (vegetationFeature) {
    const vegetationType = vegetationFeature.properties.class || "Unknown Vegetation Type";
    infoHTML += `<strong>Vegetation:</strong> ${vegetationType}<br>`;
  }

  // Display the info in the sidebar
  document.getElementById('sidebar-content').innerHTML = infoHTML;
  document.getElementById('sidebar').style.display = 'block';
});

// Add a click event to display popup information for climate and resource features.
map.on("click", (e) => {
    const climateFeatures = map.queryRenderedFeatures(e.point, { layers: ['climate-fill'] });
    const resourceFeatures = map.queryRenderedFeatures(e.point, { layers: ['resource-fill'] });
  
    // Only show a popup if relevant features are clicked
    if (!climateFeatures.length && !resourceFeatures.length) {
      return;
    }
  
    let popupHTML = "";
  
    if (climateFeatures.length > 0) {
      const climateFeature = climateFeatures[0];
      const koppenCode = climateFeature.properties.CODE;
      popupHTML += `<strong>Koppen Code:</strong> ${koppenCode}<br>`;
    }
  
    if (resourceFeatures.length > 0) {
      const resourceName = resourceFeatures[0].properties.resource || "Unknown Resource";
      popupHTML += `<strong>Resources:</strong> ${resourceName}`;
    }
  
    new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(popupHTML)
      .addTo(map);
  });
  
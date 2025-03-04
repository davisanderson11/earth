// Add a click event to display popup information for climate and resource features.
map.on("click", (e) => {
    const onLand = map.queryRenderedFeatures(e.point, { layers: ['land-fill'] });
    const climateFeatures = map.queryRenderedFeatures(e.point, { layers: ['climate-fill'] });
    const soilFeatures = map.queryRenderedFeatures(e.point, { layers: ['data-soil-fill'] });
  
    // Only show a popup if relevant features are clicked
    if (!onLand.length) {
        if (!climateFeatures.length && !soilFeatures.length) {
            return;
        }
    }  

    let popupHTML = "";
    
    if (onLand.length > 0) {
        if (climateFeatures.length > 0) {
            const climateFeature = climateFeatures[0];
            const koppenCode = climateFeature.properties.CODE;
            popupHTML += `<strong>Koppen Code:</strong> ${koppenCode}<br>`;
          }
        
          if (soilFeatures.length > 0) {
            const soilType = soilFeatures[0].properties.quality || "Unknown Soil Type";
            popupHTML += `<strong>Soil Class:</strong> ${soilType}`;
          }
          new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupHTML)
          .addTo(map);
    }
  });
  
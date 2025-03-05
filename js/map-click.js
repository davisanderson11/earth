// Add a click event to display popup information for climate and resource features.
map.on("click", (e) => {
    const onLand = map.queryRenderedFeatures(e.point, {layers:['land-fill']});
    const climateFeatures = map.queryRenderedFeatures(e.point, {layers: ['climate-fill']});
    const soilFeatures = map.queryRenderedFeatures(e.point, {layers:['data-soil-fill']});
    const vegetationFeatures = map.queryRenderedFeatures(e.point, {layers:['data-vegetation-fill']});
  
    // Only show a popup if relevant features are clicked
    if (!onLand.length) {
        if (!climateFeatures.length && !soilFeatures.length && !vegetationFeatures.length) {
            return;
        }
    }  

    let infoHTML = "";
    
    if (onLand.length > 0) {
      var coordinates = e.lngLat
      infoHTML += `<strong>Coordinates:</strong> ${coordinates}<br>`;
        if (climateFeatures.length > 0) {
            const climateFeature = climateFeatures[0];
            const koppenCode = climateFeature.properties.CODE;
            infoHTML += `<strong>Koppen Code:</strong> ${koppenCode}<br>`;
          }
        
        if (soilFeatures.length > 0) {
            const soilType = soilFeatures[0].properties.quality || "Unknown Soil Class";
            infoHTML += `<strong>Soil Class:</strong> ${soilType}<br>`;
          }
          
          if (vegetationFeatures.length > 0) {
            const vegetationType = vegetationFeatures[0].properties.class || "Unknown Vegetation Type";
            infoHTML += `<strong>Vegetation:</strong> ${vegetationType}<br>`;
          }
          
          document.getElementById('sidebar-content').innerHTML = infoHTML;
          document.getElementById('sidebar').style.display = 'block';
          //new mapboxgl.Popup()
          //.setLngLat(e.lngLat)
          //.setHTML(infoHTML)
          //.addTo(map);
    }
  });
  
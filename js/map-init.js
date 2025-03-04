// Set your Mapbox access token
mapboxgl.accessToken = "pk.eyJ1IjoiYW5kZXJzZC1wZXJzb25hbCIsImEiOiJjbTdua2FydTIwMjB6MmxxNWo4MXp3YzRnIn0.jXyp_01Vy7m3KTwixcuT1Q";

// Define the map style configuration
const styleConfig = {
  version: 8,
  name: "BlankGlobeNoTerrain",
  sources: {
    "land": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson"
    },
    "lakes": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_lakes.geojson"
    },
    "rivers": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson"
    },
    "glaciated": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_glaciated_areas.geojson"
    },
    "antarctic-ice-shelves": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_antarctic_ice_shelves_polys.geojson"
    },
    "natural-resources": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/davisanderson11/earthdata/main/geojson/resourceData.geojson"
    }
  },
  layers: [
    // Ocean background
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#00AEF5" }
    },
    // Land polygons
    {
      id: "land-fill",
      type: "fill",
      source: "land",
      paint: {
        "fill-color": "#d2c290",
        "fill-outline-color": "#c2b280"
      }
    },
    // Lakes
    {
      id: "lakes-fill",
      type: "fill",
      source: "lakes",
      paint: {
        "fill-color": "#00AEF5",
        "fill-outline-color": "#00AEF5"
      }
    },
    // Rivers
    {
      id: "rivers-line",
      type: "line",
      source: "rivers",
      paint: {
        "line-color": "#00AEF5",
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0, 0.3,
          3, 0.5,
          6, 1.0,
          10, 2.0
        ]
      }
    },
    // Glaciated areas
    {
      id: "glaciated-fill",
      type: "fill",
      source: "glaciated",
      paint: {
        "fill-color": "#ffffff",
        "fill-outline-color": "#ffffff"
      }
    },
    // Antarctic ice shelves
    {
      id: "antarctic-ice-shelves-fill",
      type: "fill",
      source: "antarctic-ice-shelves",
      paint: {
        "fill-color": "#ffffff",
        "fill-outline-color": "#ffffff"
      }
    },
    // Natural Resources (transparent fill)
    {
      id: "resource-fill",
      type: "fill",
      source: "natural-resources",
      paint: {
        "fill-color": "#000000",
        "fill-opacity": 0,
        "fill-outline-color": "#000000"
      }
    }
  ]
};

// Initialize the Mapbox map
const map = new mapboxgl.Map({
  container: "map",
  style: styleConfig,
  center: [0, 20],
  zoom: 2,
  projection: "globe"
});

// Enable additional map controls
map.dragRotate.enable();
map.touchZoomRotate.enableRotation();

// When the map loads, set the pitch and add the climate data layer and fog effect.
map.on("load", () => {
  map.setPitch(10);

  const climateUrl = "https://raw.githubusercontent.com/circleofconfusion/climate-map/master/topojson/1976-2000.geojson";

  fetch(climateUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load climate data: ${response.status}`);
      }
      return response.json();
    })
    .then(climateData => {
      // Add climate data source and layer
      map.addSource("climate", { type: "geojson", data: climateData });
      map.addLayer({
        id: "climate-fill",
        type: "fill",
        source: "climate",
        paint: {
          "fill-color": [
            "match",
            ["get", "CODE"],
            "Af",  "#228B22",
            "Am",  "#2DC12D",
            "Aw",  "#a6d96a",
            "BWh", "#fcd19c",
            "BWk", "#f4a460",
            "BSh", "#ffdda0",
            "BSk", "#ffc680",
            "Csa", "#e78670",
            "Csb", "#f6bfb2",
            "Csc", "#f8ddd7",
            "Cwa", "#fad859",
            "Cwb", "#c6e2ff",
            "Cwc", "#b3cde3",
            "Cfa", "#fadc76",
            "Cfb", "#d7ecff",
            "Cfc", "#aad4ff",
            "Dsa", "#ffa8a0",
            "Dsb", "#ffc8c0",
            "Dsc", "#ffe3dd",
            "Dsd", "#ffeceb",
            "Dfa", "#ffc04c",
            "Dfb", "#ffa500",
            "Dfc", "#a0522d",
            "Dfd", "#cd5c5c",
            "Dwa", "#ffdcdc",
            "Dwb", "#ffc7bf",
            "Dwc", "#ffb6ad",
            "Dwd", "#ffaba3",
            "ET",  "#c0d9d9",
            "EF",  "#ffffff",
            "#b8b8b8"
          ],
          "fill-outline-color": "#666666",
          "fill-opacity": 0
        }
      }, "land-fill"); // Ensure climate layer is above the land layer.
    })
    .catch(err => {
      console.error("Could not load or parse climate data:", err);
    });

  // Add fog effect for a more immersive experience.
  map.setFog({
    color: "rgb(186, 210, 235)",
    "high-color": "rgb(36, 92, 223)",
    "horizon-blend": 0.02,
    "star-intensity": 0.3
  });
});

// Expose the map object globally so other scripts (like the click handler) can access it.
window.map = map;

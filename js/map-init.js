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
    // New elevation source
    "elevation": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/davisanderson11/openGeo/main/data/geojson/elevation-1deg.geojson"
    }
  },
  layers: [
    // Elevation fill layer used for query in raycasting
    {
      id: "elevation-fill",
      type: "fill",
      source: "elevation",
      paint: {
        "fill-opacity": 0,
        "fill-color": "rgba(0,0,0,0)"
      }
    },
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
    }
  ]
};

// Initialize the map
const map = new mapboxgl.Map({
  container: "map",
  style: styleConfig,
  center: [0, 20],
  zoom: 2,
  projection: "globe"
});

// Additional map controls
map.dragRotate.enable();
map.touchZoomRotate.enableRotation();

// Load the map
map.on("load", () => {
  map.setPitch(10);
  // Create atmosphere
  map.setFog({
    color: "rgb(186, 210, 235)",
    "high-color": "rgb(36, 92, 223)",
    "horizon-blend": 0.02,
    "star-intensity": 0.3
  });
});

// Allow other scripts to access the map
window.map = map;

// Preload additional OpenGeo data
Promise.all([
  fetch("https://raw.githubusercontent.com/davisanderson11/openGeo/main/data/geojson/soil-quality-0-5deg.geojson")
    .then(response => response.json())
    .then(data => { window.soilData = data; }),
  fetch("https://raw.githubusercontent.com/davisanderson11/openGeo/main/data/geojson/vegetation-0-5deg.geojson")
    .then(response => response.json())
    .then(data => { window.vegetationData = data; }),
  fetch("https://raw.githubusercontent.com/circleofconfusion/climate-map/master/topojson/1976-2000.geojson")
    .then(response => response.json())
    .then(data => { window.climateData = data; }),
  fetch("https://raw.githubusercontent.com/davisanderson11/openGeo/main/data/geojson/elevation-1deg.geojson")
    .then(response => response.json())
    .then(data => { window.elevationData = data; })
])
.catch(err => console.error("Error loading additional data:", err));

/********************************************
 * refine-territory.js
 ********************************************/

/**
 * Refines a claimed territory so that:
 *   1) Anything off land is clipped (perfectly matching the coastline).
 *   2) If the territory boundary is within 1 degree of the coast or a river,
 *      extend it outward to exactly match that boundary’s geometry.
 *   3) Lakes can also be treated similarly if your land polygons do not already exclude them.
 *
 * The steps:
 *   - Union land polygons => landUnion
 *   - Buffer rivers => union them with landUnion so the river lines become part of the boundary
 *   - Intersect territory with landUnion => perfectly remove off-land portions
 *   - Buffer the territory by 1 degree => union with landUnion => intersect with landUnion again
 *     => territory boundary is pulled out to the coast/river geometry if it was already within 1 degree
 *
 * @param {Feature<Polygon|MultiPolygon>} rawTerritory 
 *   The raw claimed polygon from your sub-degree partial steps or BFS expansions.
 * @param {FeatureCollection|Feature<Polygon|MultiPolygon>[]|Feature<Polygon|MultiPolygon>} landFeatures 
 *   Your coastline/land polygons. If multiple, pass as FeatureCollection or array.
 * @param {FeatureCollection|Feature<Polygon|MultiPolygon>[]|Feature<Polygon|MultiPolygon>} lakeFeatures 
 *   Optional. If your land data doesn’t already subtract lakes, pass them here to incorporate them as boundaries.
 * @param {FeatureCollection|Feature<LineString|MultiLineString>[]|Feature<LineString|MultiLineString>} riverFeatures 
 *   Optional. We'll buffer these lines so territory near them “snaps” onto the river’s curve.
 * @param {number} snapDeg 
 *   The buffer distance in degrees to “snap” territory if within that range of the coast or river. 
 *   1 degree ~ 111 km at equator. Use caution if that’s too large.
 * @param {number} riverBufferDeg
 *   The buffer distance in degrees for turning rivers into thin polygons. 
 *   e.g. 0.1 => ~11 km wide corridor around the river lines.
 * 
 * @returns {Feature<Polygon|MultiPolygon>|null} 
 *   The refined territory polygon, or null if it’s entirely off land.
 */
function refineTerritory(
    rawTerritory,
    landFeatures,
    lakeFeatures,
    riverFeatures,
    snapDeg = 0.1,
    riverBufferDeg = 0.1
  ) {
    if (!rawTerritory) return null;
  
    // 1) Union all land polygons into landUnion
    let landUnion = unifyPolygons(landFeatures);
    // If lakes are separate, union them in as well (or treat them as subtracted if you want them as water).
    if (lakeFeatures) {
      const lakes = unifyPolygons(lakeFeatures);
      if (lakes && landUnion) {
        landUnion = turf.union(landUnion, lakes);
      } else if (!landUnion) {
        landUnion = lakes;
      }
    }
  
    // 2) Buffer rivers, union with land if you want the river lines to be boundaries
    if (riverFeatures && riverBufferDeg > 0) {
      const rBuf = bufferAll(riverFeatures, riverBufferDeg, "degrees");
      if (rBuf && landUnion) {
        landUnion = turf.union(landUnion, rBuf);
      } else if (rBuf && !landUnion) {
        landUnion = rBuf;
      }
    }
  
    if (!landUnion) {
      // No land data => territory is unchanged
      return rawTerritory;
    }
  
    // 3) Intersect territory with land => any portion off-land is removed,
    //    perfectly matching the coastline polygons in that region.
    let territoryOnLand = turf.intersect(rawTerritory, landUnion);
    if (!territoryOnLand) {
      // Nothing overlapped
      return null;
    }
  
    // 4) If the boundary is within snapDeg of the coastline/river, 
    //    we extend it outward to match the boundary exactly.
    //    We do so by:
    //       a) buffer territory by snapDeg => territoryBuff
    //       b) union territoryBuff with landUnion => territoryBuffUnion
    //       c) intersect territoryBuffUnion with landUnion => final
    //    This forcibly merges territory with any land boundary that was within snapDeg.
    if (snapDeg > 0) {
      const territoryBuff = turf.buffer(territoryOnLand, snapDeg, { units: "degrees" });
      // union with land => so we adopt the coastline geometry
      const territoryBuffUnion = turf.union(territoryBuff, landUnion);
      // intersect again => we remain on land but incorporate the extended boundary
      const final = turf.intersect(territoryBuffUnion, landUnion);
      if (final) {
        return final;
      }
    }
  
    // If we fail or snapDeg=0, fallback is territoryOnLand
    return territoryOnLand;
  }
  
  /**
   * Unifies an array or FeatureCollection of polygons into one geometry.
   * If landFeatures is a single Feature or geometry, we just return that.
   */
  function unifyPolygons(landFeatures) {
    if (!landFeatures) return null;
  
    // If it's a single feature
    if (landFeatures.type === "Feature" && (landFeatures.geometry.type.endsWith("Polygon"))) {
      return landFeatures;
    }
    // If it's a FeatureCollection
    if (landFeatures.type === "FeatureCollection") {
      return unionAll(landFeatures.features);
    }
    // If it's an array
    if (Array.isArray(landFeatures)) {
      return unionAll(landFeatures);
    }
    return landFeatures; 
  }
  
  /**
   * Unions an array of polygons or multi-polygons into a single geometry.
   */
  function unionAll(features) {
    if (!features || !features.length) return null;
    let result = features[0];
    for (let i = 1; i < features.length; i++) {
      result = turf.union(result, features[i]);
      if (!result) break; // union can fail if geometry is invalid
    }
    return result;
  }
  
  /**
   * Buffers an array or FeatureCollection of lines/polygons by 'dist' in the specified units,
   * then unions them all together, returning a single polygon or multi-polygon.
   * e.g. bufferAll(riverFeatures, 0.1, "degrees") => 0.1° thick corridor around lines
   */
  function bufferAll(input, dist, units) {
    if (!input || dist <= 0) return null;
  
    let feats = [];
    if (input.type === "FeatureCollection") {
      feats = input.features;
    } else if (Array.isArray(input)) {
      feats = input;
    } else {
      feats = [input];
    }
  
    let out = null;
    for (const f of feats) {
      try {
        const b = turf.buffer(f, dist, { units });
        out = out ? turf.union(out, b) : b;
      } catch (err) {
        console.warn("Buffer error on feature:", err);
      }
    }
    return out;
  }
  
  // If using ESM modules, export it:
  // export { refineTerritory };
  
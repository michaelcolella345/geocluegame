// Builds data/map-shapes.json: one SVG outline per GeoClue country, used to shade guesses
// on the live map. Run from this folder after `npm install d3-geo@3 topojson-client@3 world-atlas@2`:
//   node build-shapes.mjs
// Shapes come from Natural Earth (public domain) via the world-atlas package, drawn in the same
// equirectangular layout as assets/map/terrain.jpg (1024 wide, latitudes 84°N to 60°S).
import fs from "fs";
import { createRequire } from "module";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
// 110m outlines are plenty for shading; 50m fills in the small countries 110m leaves out.
const coarse = require("world-atlas/countries-110m.json");
const fine = require("world-atlas/countries-50m.json");
const countries = JSON.parse(fs.readFileSync("../../data/countries.json", "utf8"));

// Our country name -> Natural Earth name, where they differ.
const NE = {
  "Antigua and Barbuda": "Antigua and Barb.", "Bosnia and Herzegovina": "Bosnia and Herz.",
  "Central African Republic": "Central African Rep.", "Dominican Republic": "Dominican Rep.",
  "DR Congo": "Dem. Rep. Congo", "Equatorial Guinea": "Eq. Guinea", "Eswatini": "eSwatini",
  "Ivory Coast": "Côte d'Ivoire", "Marshall Islands": "Marshall Is.", "North Macedonia": "Macedonia",
  "Saint Kitts and Nevis": "St. Kitts and Nevis", "Saint Vincent and the Grenadines": "St. Vin. and Gren.",
  "Sao Tome and Principe": "São Tomé and Principe", "Solomon Islands": "Solomon Is.",
  "South Sudan": "S. Sudan", "United States": "United States of America", "Vatican City": "Vatican",
};

export const WIDTH = 1024, NORTH = 84, SOUTH = -60;
const scale = WIDTH / (2 * Math.PI);
const proj = geoEquirectangular().scale(scale).translate([WIDTH / 2, scale * NORTH * Math.PI / 180]);
const path = geoPath(proj).digits(1);
const height = +(scale * (NORTH - SOUTH) * Math.PI / 180).toFixed(1);

const index = (topo) => new Map(feature(topo, topo.objects.countries).features.map((f) => [f.properties.name, f]));
const [byCoarse, byFine] = [index(coarse), index(fine)];
const shapes = {}, missing = [];
for (const c of countries) {
  const ne = NE[c.name] || c.name;
  const f = byCoarse.get(ne) || byFine.get(ne);
  const d = f && path(f);
  if (d) shapes[c.name] = d; else missing.push(c.name);
}
fs.writeFileSync("../../data/map-shapes.json", JSON.stringify({ width: WIDTH, height, north: NORTH, shapes }));
console.log(`${Object.keys(shapes).length} shapes, ${height} tall. No shape (pin only): ${missing.join(", ") || "none"}`);

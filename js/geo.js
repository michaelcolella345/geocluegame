// Distance, direction and "temperature" between two countries' center points.
import { CONFIG } from "./config.js";

const EARTH_RADIUS_MI = 3958.8;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// Great-circle distance in miles between two {lat, lon} points.
export function distanceMiles(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Compass bearing in degrees (0 = north, 90 = east) for the shortest route from a to b.
export function bearing(a, b) {
  const [la1, lo1, la2, lo2] = [a.lat, a.lon, b.lat, b.lon].map(rad);
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

const POINTS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
export const compassWord = (b) => POINTS[Math.round(b / 45) % 8];

// "win" for a correct guess, otherwise hot / warm / mild / cold by distance.
export function band(miles, correct = false) {
  if (correct) return "win";
  const { HOT, WARM, MILD } = CONFIG.BANDS;
  return miles < HOT ? "hot" : miles < WARM ? "warm" : miles < MILD ? "mild" : "cold";
}

export const BAND_EMOJI = { win: "🟩", hot: "🟥", warm: "🟧", mild: "🟨", cold: "🟦" };
export const BAND_LABEL = { win: "Correct", hot: "Hot", warm: "Warm", mild: "Mild", cold: "Cold" };

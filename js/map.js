// Live map under the clues: a borderless terrain map that shades each guessed country in its
// hot/warm/mild/cold color and drops a numbered pin on it. Drag to move (it wraps around
// sideways like a globe), pinch, scroll or use the buttons to zoom.
//
// Everything is laid out in "world units": the terrain image is WIDTH wide, from NORTH degrees
// latitude down to 60°S, in an equirectangular layout (see tools/map). One layer holding three
// side-by-side copies of the world is moved and scaled with a CSS transform, which is what lets
// the map wrap around without an edge.

const TERRAIN = "assets/map/terrain.jpg";
const MIN_W = 70;          // most zoomed in: world units across the view
const ZOOM_STEP = 0.7;

const $el = (tag, cls, attrs = {}) => {
  const ns = ["svg", "g", "path"].includes(tag) ? "http://www.w3.org/2000/svg" : null;
  const e = ns ? document.createElementNS(ns, tag) : document.createElement(tag);
  if (cls) e.setAttribute("class", cls);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

export async function loadShapes(url = "data/map-shapes.json") {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// root: the element to fill. byName: country name -> {lat, lon}. shapes: data/map-shapes.json.
export function createMap(root, byName, shapes) {
  const W = shapes.width, H = shapes.height, PER_DEG = W / 360;
  const toXY = (c) => [(c.lon + 180) * PER_DEG, (shapes.north - c.lat) * PER_DEG];

  root.innerHTML = "";
  const view = $el("div", "map-view", { tabindex: "0", role: "group", "aria-label": "Map of your guesses. Drag or use the arrow keys to move, plus and minus to zoom." });
  const world = $el("div", "map-world");
  world.style.width = `${W}px`;
  world.style.height = `${H}px`;
  const terrain = $el("div", "map-terrain");
  terrain.style.cssText = `left:${-W}px;width:${3 * W}px;height:${H}px;background-image:url(${TERRAIN});background-size:${W}px ${H}px`;
  const svg = $el("svg", "map-shapes", { viewBox: `${-W} 0 ${3 * W} ${H}`, width: 3 * W, height: H, "aria-hidden": "true" });
  svg.style.left = `${-W}px`;
  const copies = [-W, 0, W].map((dx) => svg.appendChild($el("g", null, { transform: `translate(${dx} 0)` })));
  const pins = $el("div", "map-pins", { "aria-hidden": "true" });
  world.append(terrain, svg, pins);
  view.append(world);

  const zoom = $el("div", "map-zoom");
  const btn = (label, text, fn) => {
    const b = $el("button", "icon", { type: "button", "aria-label": label });
    b.textContent = text;
    b.addEventListener("click", fn);
    zoom.append(b);
  };
  btn("Zoom in", "+", () => zoomBy(ZOOM_STEP));
  btn("Zoom out", "−", () => zoomBy(1 / ZOOM_STEP));
  btn("Reset the map", "⟲", () => { v = null; draw(); });
  root.append(view, zoom);

  // ---------- Camera ----------
  // v = left edge, top edge and width of what's visible, in world units.
  const aspect = () => view.clientHeight / Math.max(1, view.clientWidth);
  // Start with the map's full height in view, centered just east of Greenwich.
  const home = () => { const w = Math.min(W, H / aspect()); return { x: W / 2 + 10 * PER_DEG - w / 2, y: 0, w }; };
  let v = null; // set on the first draw, once the view has a size

  function draw() {
    if (!view.clientWidth) return; // hidden: draw again once it's shown
    if (!v) v = home();
    v.w = Math.min(Math.max(v.w, MIN_W), W);
    v.x = ((v.x % W) + W) % W; // wrap sideways
    const vh = v.w * aspect();
    v.y = vh >= H ? (H - vh) / 2 : Math.min(Math.max(v.y, 0), H - vh);
    const k = view.clientWidth / v.w;
    world.style.transform = `scale(${k}) translate(${-v.x}px, ${-v.y}px)`;
    world.style.setProperty("--pin-scale", String(1 / k));
  }
  // Zoom by factor f, keeping the point at (fx, fy) (fractions of the view) still.
  function zoomBy(f, fx = 0.5, fy = 0.5) {
    if (!v) return;
    const a = aspect(), w = Math.min(Math.max(v.w * f, MIN_W), W);
    v.x += (v.w - w) * fx;
    v.y += (v.w - w) * a * fy;
    v.w = w;
    draw();
  }
  function panBy(dxPx, dyPx) {
    if (!v) return;
    const s = v.w / view.clientWidth;
    v.x -= dxPx * s;
    v.y -= dyPx * s;
    draw();
  }

  // ---------- Drag, pinch, wheel, keys ----------
  const pointers = new Map();
  let pinch = null;
  view.addEventListener("pointerdown", (e) => {
    view.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    view.classList.add("dragging");
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), w: v.w };
    }
  });
  view.addEventListener("pointermove", (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], r = view.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      zoomBy((pinch.w * pinch.dist) / dist / v.w, ((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height);
    } else if (pointers.size === 1) {
      panBy(cur.x - prev.x, cur.y - prev.y);
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) view.classList.remove("dragging");
  };
  view.addEventListener("pointerup", release);
  view.addEventListener("pointercancel", release);
  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = view.getBoundingClientRect();
    zoomBy(Math.exp(e.deltaY * 0.0015), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, { passive: false });
  view.addEventListener("keydown", (e) => {
    const step = view.clientWidth * 0.15;
    const keys = {
      ArrowLeft: () => panBy(step, 0), ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step), ArrowDown: () => panBy(0, -step),
      "+": () => zoomBy(ZOOM_STEP), "=": () => zoomBy(ZOOM_STEP), "-": () => zoomBy(1 / ZOOM_STEP),
    };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  });
  if ("ResizeObserver" in window) new ResizeObserver(draw).observe(view);
  else addEventListener("resize", draw);

  // ---------- Guesses ----------
  let shown = 0;
  // rows: scored guesses in order ({name, band, correct}). answer is shaded once the game is done.
  function update(rows, { answer = null, done = false } = {}) {
    const marks = rows.map((r, i) => ({ name: r.name, band: r.band, label: r.correct ? "✓" : String(i + 1) }));
    if (done && answer && !rows.some((r) => r.correct)) marks.push({ name: answer, band: "win", label: "✓" });
    const fresh = marks.length > shown ? marks.length - 1 : -1;
    shown = marks.length;

    for (const g of copies) g.replaceChildren();
    pins.replaceChildren();
    marks.forEach((m, i) => {
      const cls = `${m.band}${i === fresh ? " new" : ""}`;
      const d = shapes.shapes[m.name];
      if (d) for (const g of copies) g.append($el("path", `map-country ${cls}`, { d }));
      const c = byName.get(m.name);
      if (!c) return;
      const [x, y] = toXY(c);
      for (const dx of [-W, 0, W]) {
        const pin = $el("div", `map-pin ${cls}`);
        pin.style.left = `${x + dx}px`;
        pin.style.top = `${y}px`;
        pin.textContent = m.label;
        pins.append(pin);
      }
    });
  }

  // Back to the starting view for a new day.
  function reset() { v = null; shown = 0; draw(); }

  draw();
  return { update, reset };
}

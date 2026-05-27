// AirAware Vienna - main app

const { useState, useEffect, useRef } = React;

// ──────────────── TWEAKS / CONSTANTS ────────────────
const COLORS = {
  primary: '#7c3aed', // purple
  primaryDeep: '#6d28d9',
  good: '#16a34a',
  ok: '#3b82f6',
  warn: '#f97316',
  bad: '#dc2626',
  dark: '#1a1a1f'
};

// All coordinates are real Vienna lat/lng.
const USER_POS = [48.19120, 16.36120]; // Margareten / 5th district
const DEST_POS = [48.18715, 16.35333]; // HTL Spengergasse area
const MAP_CENTER = [48.19150, 16.36300];

// ──────────────── ORGANIC POLLUTION BLOBS ────────────────
// Generates a freeform polygon with 18 points whose radii vary smoothly,
// so the polygon looks like an irregular pollution cloud rather than a hex.
function _blob(center, baseRadius, seed) {
  const [lat, lng] = center;
  const NUM = 18;
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const a = rand() * Math.PI * 2;
  const b = rand() * Math.PI * 2;
  const c = rand() * Math.PI * 2;
  const pts = [];
  for (let i = 0; i < NUM; i++) {
    const ang = (i / NUM) * Math.PI * 2;
    // Layered low-frequency noise → smooth, lumpy outline
    let r = 1 + 0.30 * Math.sin(ang * 2 + a)
              + 0.18 * Math.sin(ang * 3 + b)
              + 0.10 * Math.sin(ang * 5 + c);
    r = Math.max(0.55, r);
    // At 48°N, 1° lng ≈ 0.67 × 1° lat in metres → scale lng to keep blobs round
    pts.push([
      lat + Math.sin(ang) * baseRadius * r,
      lng + Math.cos(ang) * baseRadius * r * 1.5
    ]);
  }
  return pts;
}

// Heat hotspots: a cluster of red zones around and between user & destination
// so the route has to weave around them, plus broader yellow context across
// the map.
const HOTSPOTS = [
  // RED — the central red blob sits right on the direct line from
  // the user to HTL Spengergasse, so the green route must detour.
  { color: 'red', coords: _blob([48.18920, 16.35720], 0.00110,  7) },
  { color: 'red', coords: _blob([48.19460, 16.36180], 0.00080, 11) }, // N of user
  { color: 'red', coords: _blob([48.19080, 16.36540], 0.00090, 17) }, // E of user
  { color: 'red', coords: _blob([48.19720, 16.35280], 0.00115, 23) }, // Mariahilfer Str.
  { color: 'red', coords: _blob([48.19200, 16.36980], 0.00100, 29) }, // Wiedner Hauptstr.
  { color: 'red', coords: _blob([48.20240, 16.36050], 0.00105, 31) }, // Gürtel
  { color: 'red', coords: _blob([48.18540, 16.36800], 0.00100, 37) }, // S of dest
  // YELLOW — broader haze across the map
  { color: 'yellow', coords: _blob([48.19850, 16.36050], 0.00130, 41) },
  { color: 'yellow', coords: _blob([48.20100, 16.36800], 0.00125, 43) },
  { color: 'yellow', coords: _blob([48.18900, 16.35400], 0.00100, 47) },
  { color: 'yellow', coords: _blob([48.18280, 16.36100], 0.00115, 53) },
  { color: 'yellow', coords: _blob([48.19600, 16.37400], 0.00105, 59) },
  { color: 'yellow', coords: _blob([48.20000, 16.37280], 0.00115, 61) },
  { color: 'yellow', coords: _blob([48.18500, 16.37200], 0.00105, 67) },
];

// Health-priority route — dips south first to skirt the central red blob,
// then arcs west to HTL Spengergasse. Each waypoint is visibly outside
// every red zone.
const HEALTH_ROUTE = [
  [48.19120, 16.36120], // user
  [48.19010, 16.36180],
  [48.18900, 16.36210],
  [48.18790, 16.36200],
  [48.18700, 16.36100],
  [48.18650, 16.35940],
  [48.18650, 16.35760],
  [48.18660, 16.35580],
  [48.18680, 16.35430],
  [48.18715, 16.35333]  // HTL Spengergasse
];

// Fastest route — direct line from the user to HTL Spengergasse along the
// main road grid. Cuts right through the central red blob.
const FASTEST_ROUTE = [
  [48.19120, 16.36120], // user
  [48.19060, 16.36000],
  [48.18990, 16.35870],
  [48.18920, 16.35720],  // inside red zone
  [48.18860, 16.35600],
  [48.18810, 16.35490],
  [48.18760, 16.35400],
  [48.18715, 16.35333]   // HTL Spengergasse
];

// Marker walk for the lock-screen simulation: starts safe at the user's home,
// moves NW through transit zones and ends inside the Mariahilfer Str. red zone.
const DANGER_WALK = [
  { p: 'safe',    pos: [48.19120, 16.36120] },
  { p: 'safe',    pos: [48.19200, 16.35980] },
  { p: 'safe',    pos: [48.19320, 16.35820] },
  { p: 'transit', pos: [48.19440, 16.35660] },
  { p: 'transit', pos: [48.19560, 16.35500] },
  { p: 'transit', pos: [48.19650, 16.35400] },
  { p: 'danger',  pos: [48.19710, 16.35320] },
  { p: 'danger',  pos: [48.19720, 16.35280] },  // inside Mariahilfer red
  { p: 'danger',  pos: [48.19720, 16.35280] }
];

// Path the delivery driver walks during Contribute simulation — a noticeable
// SE arc so the streets visibly slide past as the map follows the marker.
const CONTRIB_WALK = [
  [48.19120, 16.36120],
  [48.19000, 16.36300],
  [48.18880, 16.36500],
  [48.18760, 16.36700],
  [48.18640, 16.36900],
  [48.18520, 16.37100],
  [48.18400, 16.37300],
  [48.18280, 16.37500],
  [48.18170, 16.37700]
];

// ──────────────── POSITION-BASED SCORING ────────────────
// Approximates "how clean is the air right where I am?" by summing weighted
// distance falloffs from each hotspot centroid. Red zones drop the score
// hard; yellow zones nudge it down. Inside a red blob → score ≈ 15;
// outside everything → ≈ 92.
function scoreForPosition(pos, hotspots) {
  if (!pos) return 88;
  const [lat, lng] = pos;
  let penalty = 0;
  for (const h of hotspots || []) {
    const n = h.coords.length;
    const cLat = h.coords.reduce((a, p) => a + p[0], 0) / n;
    const cLng = h.coords.reduce((a, p) => a + p[1], 0) / n;
    const dLat = lat - cLat;
    const dLng = (lng - cLng) * 0.67;        // lng-to-distance at 48°N
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    const radius = h.color === 'red' ? 0.00260 : 0.00280;
    const falloff = Math.max(0, 1 - dist / radius);
    const intensity = h.color === 'red' ? 82 : 28;
    penalty += intensity * falloff;
  }
  return Math.max(8, Math.min(94, Math.round(92 - penalty)));
}



// ──────────────── ICONS ────────────────
const Icon = {
  search: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" {...p}><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  smile: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M8 14c1 1.5 2.5 2.5 4 2.5s3-1 4-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  neutral: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M8 15h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  meh: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M9 16c1-1 2-1.5 3-1.5s2 .5 3 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  sad: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" {...p} style={{ width: "20px", height: "20px" }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="15" cy="10" r="1" fill="currentColor" /><path d="M8 17c1-2 2.5-3 4-3s3 1 4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  bluetooth: (p) => <svg width={p.s || 16} height={p.s || 16} viewBox="0 0 24 24" fill="none" {...p}><path d="M7 7l10 10-5 5V2l5 5L7 17" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>,
  chevDown: (p) => <svg width={p.s || 14} height={p.s || 14} viewBox="0 0 24 24" fill="none" {...p}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  heart: (p) => <svg width={p.s || 48} height={p.s || 48} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5a5.5 5.5 0 019.5 7c-2.5 4.5-9.5 9-9.5 9z" /></svg>,
  info: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" {...p}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 11v6M12 8v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  close: (p) => <svg width={p.s || 18} height={p.s || 18} viewBox="0 0 24 24" fill="none" {...p}><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  walk: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" {...p}><circle cx="13" cy="4" r="2" fill="currentColor" /><path d="M9 22l2-7-3-2 1-5 4 1 3 4 3 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>,
  lightning: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>,
  shield: (p) => <svg width={p.s || 22} height={p.s || 22} viewBox="0 0 24 24" fill="none" {...p}><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
};

// Score -> theme
function scoreTheme(score) {
  if (score >= 85) return { bg: '#16a34a', text: '#fff', icon: 'smile', label: 'Excellent' };
  if (score >= 60) return { bg: '#2563eb', text: '#fff', icon: 'neutral', label: 'Average' };
  if (score >= 35) return { bg: '#f97316', text: '#fff', icon: 'meh', label: 'Low' };
  return { bg: '#dc2626', text: '#fff', icon: 'sad', label: 'Hazardous' };
}

window.AA = { COLORS, USER_POS, DEST_POS, MAP_CENTER, HOTSPOTS, HEALTH_ROUTE, FASTEST_ROUTE, DANGER_WALK, CONTRIB_WALK, Icon, scoreTheme, scoreForPosition };
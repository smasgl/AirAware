// Leaflet wrapper for AirAware.
// All coordinates are real Vienna lat/lng. Tiles: CartoDB Positron (free, attributed).
// Heat hotspots live in a blurred custom pane to give a soft heatmap look.

const { useEffect: useEffectL, useRef: useRefL } = React;

function LeafletMap({
  center,                  // [lat, lng]
  zoom,                    // number
  hotspots = [],           // [{coords:[[lat,lng]...], color:'red'|'yellow'}]
  route = null,            // [[lat,lng], ...]
  routeColor = 'green',    // 'green' | 'red'
  userPos = null,          // [lat, lng]
  destinationPos = null,   // [lat, lng]
  greenTrail = [],         // [[lat,lng], ...]
  pulseUser = false,
  followUser = false,
  fitBounds = null,        // [[lat,lng], ...] — overrides center/follow when set
  fitBoundsPadding = null, // [px, px]
  tileStyle = 'positron',  // 'positron' | 'dark'
  hotspotIntensity = 1,    // multiplier for fillOpacity
  showAttribution = false,
  style = {},
}) {
  const containerRef = useRefL(null);
  const mapRef = useRefL(null);
  const layersRef = useRefL({
    tiles: null,
    hotspots: null,
    route: null, routeCasing: null, routeDash: null,
    user: null,
    destination: null,
    trail: null,
  });

  // init once
  useEffectL(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: showAttribution,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      touchZoom: false,
      fadeAnimation: true,
      zoomAnimation: true,
      zoomSnap: 0.25,
    }).setView(center, zoom);

    layersRef.current.tiles = L.tileLayer(tileUrl(tileStyle), {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap · © CARTO',
    }).addTo(m);

    // panes
    m.createPane('heatPane');
    m.getPane('heatPane').style.filter = 'blur(18px)';
    m.getPane('heatPane').style.zIndex = 380;
    m.getPane('heatPane').style.pointerEvents = 'none';

    m.createPane('trailPane');
    m.getPane('trailPane').style.filter = 'blur(8px)';
    m.getPane('trailPane').style.zIndex = 390;
    m.getPane('trailPane').style.pointerEvents = 'none';

    m.createPane('routePane');
    m.getPane('routePane').style.zIndex = 410;
    m.getPane('routePane').style.pointerEvents = 'none';

    m.createPane('markerPane2');
    m.getPane('markerPane2').style.zIndex = 600;

    mapRef.current = m;

    // Sometimes the container is briefly the wrong size
    setTimeout(() => m.invalidateSize(), 30);
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      m.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line
  }, []);

  // view (center/zoom) + follow
  useEffectL(() => {
    if (!mapRef.current) return;
    if (fitBounds && fitBounds.length >= 2) {
      const bounds = L.latLngBounds(fitBounds);
      mapRef.current.flyToBounds(bounds, {
        padding: fitBoundsPadding || [50, 50],
        duration: 0.6,
        easeLinearity: 0.4,
        maxZoom: 17,
      });
    } else if (followUser && userPos) {
      // Drive map position directly each frame — rAF caller smooths motion;
      // Leaflet's own pan animation would fight the per-frame updates.
      mapRef.current.setView(userPos, zoom, { animate: false });
    } else {
      mapRef.current.flyTo(center, zoom, { duration: 0.6, easeLinearity: 0.4 });
    }
  }, [center?.[0], center?.[1], zoom, followUser, userPos?.[0], userPos?.[1], JSON.stringify(fitBounds)]);

  // tile style — swap layer when changed
  useEffectL(() => {
    if (!mapRef.current) return;
    if (layersRef.current.tiles) mapRef.current.removeLayer(layersRef.current.tiles);
    layersRef.current.tiles = L.tileLayer(tileUrl(tileStyle), {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap · © CARTO',
    }).addTo(mapRef.current);
  }, [tileStyle]);

  // hotspots
  useEffectL(() => {
    if (!mapRef.current) return;
    if (layersRef.current.hotspots) mapRef.current.removeLayer(layersRef.current.hotspots);
    const group = L.layerGroup();
    const k = Math.max(0, Math.min(2, hotspotIntensity));
    hotspots.forEach(h => {
      L.polygon(h.coords, {
        pane: 'heatPane',
        color: 'transparent',
        fillColor: h.color === 'red' ? '#dc2626' : '#facc15',
        fillOpacity: Math.min(0.9, (h.color === 'red' ? 0.62 : 0.55) * k),
        weight: 0,
        smoothFactor: 2.4,
      }).addTo(group);
    });
    group.addTo(mapRef.current);
    layersRef.current.hotspots = group;
  }, [JSON.stringify(hotspots), hotspotIntensity]);

  // route
  useEffectL(() => {
    if (!mapRef.current) return;
    ['route','routeCasing','routeDash'].forEach(k => {
      if (layersRef.current[k]) { mapRef.current.removeLayer(layersRef.current[k]); layersRef.current[k] = null; }
    });
    if (route && route.length > 1) {
      const isRed = routeColor === 'red';
      const casing = isRed ? '#991b1b' : '#15803d';
      const main   = isRed ? '#ef4444' : '#22c55e';
      layersRef.current.routeCasing = L.polyline(route, {
        pane: 'routePane',
        color: casing, weight: 16, opacity: isRed ? 0.30 : 0.35,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(mapRef.current);
      layersRef.current.route = L.polyline(route, {
        pane: 'routePane',
        color: main, weight: 8, opacity: 1,
        dashArray: isRed ? '12 8' : null,
        lineCap: 'round', lineJoin: 'round',
      }).addTo(mapRef.current);
      if (!isRed) {
        layersRef.current.routeDash = L.polyline(route, {
          pane: 'routePane',
          color: '#ffffff', weight: 1.6, opacity: 0.85,
          dashArray: '2 10',
          lineCap: 'round', lineJoin: 'round',
        }).addTo(mapRef.current);
      }
    }
  }, [JSON.stringify(route), routeColor]);

  // user marker — build once, update lat/lng each frame so smooth rAF
  // motion doesn't recreate the DOM node every tick.
  useEffectL(() => {
    if (!mapRef.current) return;
    if (!userPos) {
      if (layersRef.current.user) {
        mapRef.current.removeLayer(layersRef.current.user);
        layersRef.current.user = null;
      }
      return;
    }
    if (!layersRef.current.user) {
      const icon = L.divIcon({
        className: 'aa-user-icon',
        html:
          `<div class="aa-user ${pulseUser ? 'aa-user-pulse' : ''}">
             <span class="aa-user-ring"></span>
             <span class="aa-user-halo"></span>
             <span class="aa-user-dot"></span>
           </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      layersRef.current.user = L.marker(userPos, { icon, pane: 'markerPane2' }).addTo(mapRef.current);
    } else {
      layersRef.current.user.setLatLng(userPos);
      // toggle pulse class without remounting
      const el = layersRef.current.user.getElement();
      const inner = el && el.querySelector('.aa-user');
      if (inner) inner.classList.toggle('aa-user-pulse', !!pulseUser);
    }
  }, [userPos?.[0], userPos?.[1], pulseUser]);

  // destination pin
  useEffectL(() => {
    if (!mapRef.current) return;
    if (layersRef.current.destination) mapRef.current.removeLayer(layersRef.current.destination);
    if (destinationPos) {
      const icon = L.divIcon({
        className: 'aa-dest-icon',
        html:
          `<svg width="32" height="40" viewBox="0 0 32 40">
             <path d="M16 1 C24 1 30 7 30 15 C30 25 16 38 16 38 C16 38 2 25 2 15 C2 7 8 1 16 1 Z"
                   fill="#7c3aed" stroke="white" stroke-width="2"/>
             <circle cx="16" cy="15" r="5" fill="white"/>
           </svg>`,
        iconSize: [32, 40],
        iconAnchor: [16, 38],
      });
      layersRef.current.destination = L.marker(destinationPos, { icon, pane: 'markerPane2' }).addTo(mapRef.current);
    }
  }, [destinationPos?.[0], destinationPos?.[1]]);

  // green trail (or score-colored, when trail items have shape {pos, color})
  useEffectL(() => {
    if (!mapRef.current) return;
    if (layersRef.current.trail) mapRef.current.removeLayer(layersRef.current.trail);
    if (greenTrail && greenTrail.length > 0) {
      const group = L.layerGroup();
      greenTrail.forEach((pt, i) => {
        const age = (greenTrail.length - 1 - i) / Math.max(1, greenTrail.length);
        const isObj = pt && !Array.isArray(pt);
        const pos = isObj ? pt.pos : pt;
        const color = isObj ? pt.color : '#22c55e';
        L.circle(pos, {
          pane: 'trailPane',
          radius: 55,
          color: 'transparent',
          fillColor: color,
          fillOpacity: 0.42 * (1 - age * 0.45),
          weight: 0,
        }).addTo(group);
      });
      group.addTo(mapRef.current);
      layersRef.current.trail = group;
    }
  }, [JSON.stringify(greenTrail)]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        background: '#e8e6df',
        position: 'relative',
        // Isolate Leaflet's internal z-index stack (panes go up to ~700)
        // so our UI overlays sit above the map.
        isolation: 'isolate',
        zIndex: 0,
        ...style,
      }}
    />
  );
}

function tileUrl(style) {
  return style === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
}

// Generate extra pollution polygons scattered around `center` based on density 0–100.
// Stable across renders via a fixed seed.
function generateHotspots(baseHotspots, density, center = [48.19150, 16.36300]) {
  if (!density || density <= 0) return baseHotspots;
  const extras = [];
  const count = Math.round((density / 100) * 22);
  let seed = 1337;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 0; i < count; i++) {
    const cLat = center[0] + (rand() - 0.5) * 0.026;
    const cLng = center[1] + (rand() - 0.5) * 0.034;
    const r = 0.0006 + rand() * 0.0014;
    const color = rand() < 0.62 ? 'yellow' : 'red';
    const coords = [];
    const sides = 5 + Math.floor(rand() * 3);
    for (let a = 0; a < sides; a++) {
      const ang = (a / sides) * Math.PI * 2;
      const jitter = 0.7 + rand() * 0.7;
      coords.push([cLat + Math.cos(ang) * r * jitter, cLng + Math.sin(ang) * r * jitter * 1.35]);
    }
    extras.push({ color, coords });
  }
  return [...baseHotspots, ...extras];
}

window.LeafletMap = LeafletMap;
window.generateHotspots = generateHotspots;

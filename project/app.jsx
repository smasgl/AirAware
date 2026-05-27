// AirAware Vienna — interactive prototype
// Scope is intentionally narrow. Features (per spec):
//  - iPhone frame + dynamic island
//  - Dark in-app header with "AirAware" + Map/Contribute tab switcher (purple = active)
//  - Map tab: Vienna map, current-location marker, heatmap overlays (green/yellow/red),
//    white search bar (clicking simulates "HTL Spengergasse"), routing overlay
//    (Health priority / Fastest), Green Corridor when Health priority is picked,
//    and a fixed Breathe-Score banner at the bottom whose color + icon depend on score.
//  - Right-side info panel describing the current screen + info-icon toggle to show/hide

const { useState, useEffect, useRef, forwardRef, useImperativeHandle } = React;

// ─────────────────────────────────────────────────────────────
// Heatmap zones — yellow (slightly bad) and red (dangerous).
// (Green zones removed at user's request.)
// Each zone is rendered as a freeform polygon blob, not a circle.
// ─────────────────────────────────────────────────────────────
const HEATMAP_ZONES = [
  // YELLOW — slightly bad
  { lat: 48.2030, lng: 16.3590, radius: 280, color: '#F5C518', seed: 1.3 },
  { lat: 48.2110, lng: 16.3825, radius: 240, color: '#F5C518', seed: 2.7 },
  { lat: 48.1920, lng: 16.3700, radius: 220, color: '#F5C518', seed: 4.1 },
  { lat: 48.2060, lng: 16.3680, radius: 200, color: '#F5C518', seed: 5.9 },

  // RED — dangerous (heavy traffic corridors)
  { lat: 48.2005, lng: 16.3690, radius: 260, color: '#EF4444', seed: 0.7 }, // Karlsplatz / Ring south
  { lat: 48.1985, lng: 16.3390, radius: 300, color: '#EF4444', seed: 3.4 }, // Westbahnhof / Gürtel
  { lat: 48.2180, lng: 16.3920, radius: 260, color: '#EF4444', seed: 6.1 }, // Praterstern
  { lat: 48.2055, lng: 16.3625, radius: 200, color: '#EF4444', seed: 8.2 }, // Mariahilfer Str.
];

// Green Corridor — Stephansplatz → closer destination, traced along the
// 1st-district street grid (Kärntner Str. → Operngasse → Bürgerspitalg.)
// to skirt the red zone at Karlsplatz. Shorter and more street-aligned.
const GREEN_CORRIDOR = [
  [48.2082, 16.3738], // Stephansplatz (current location)
  [48.2070, 16.3722], // Kärntner Straße
  [48.2057, 16.3712],
  [48.2046, 16.3704],
  [48.2034, 16.3692], // Operngasse turn
  [48.2026, 16.3678], // detour west around red zone
  [48.2020, 16.3662], // Bürgerspitalgasse
  [48.2013, 16.3650], // destination
];

const CURRENT_LOCATION = [48.2082, 16.3738];
const DEST_SPENGERGASSE = [48.2013, 16.3650]; // shorter — same end point as corridor

// Generate a closed polygon of n points around a center with radius varying
// organically (layered sine waves) → freeform blob shape instead of a circle.
function freeformBlob(center, baseR, seed = 1, n = 28) {
  const latM = 111319;
  const lngM = 111319 * Math.cos(center[0] * Math.PI / 180);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = baseR * (1 +
      Math.sin(a * 2 + seed) * 0.18 +
      Math.sin(a * 3 + seed * 1.7) * 0.10 +
      Math.sin(a * 5 + seed * 2.3) * 0.06
    );
    pts.push([
      center[0] + (r * Math.cos(a)) / latM,
      center[1] + (r * Math.sin(a)) / lngM,
    ]);
  }
  return pts;
}

// Approx meters between two lat/lng points (equirectangular — fine at city scale)
function metersBetween([lat1, lng1], [lat2, lng2]) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const x = (toRad(lng2 - lng1)) * Math.cos(toRad((lat1 + lat2) / 2));
  const y = toRad(lat2 - lat1);
  return Math.sqrt(x * x + y * y) * R;
}

// Map a point to a Breathe-Score by checking which heatmap zone (if any)
// contains it. Red > Yellow priority. No containing zone = average.
function breatheScoreFor(point) {
  const priority = { '#EF4444': 0, '#F5C518': 1 };
  const hit = HEATMAP_ZONES
    .filter(z => metersBetween(point, [z.lat, z.lng]) <= z.radius)
    .sort((a, b) => priority[a.color] - priority[b.color])[0];
  if (!hit) return 69;                   // average → blue / neutral
  if (hit.color === '#EF4444') return 12; // red → sad
  return 45;                              // yellow → orange / slightly sad
}

// ─────────────────────────────────────────────────────────────
// Map (Leaflet) — Vienna + heatmap overlays + corridor
// ─────────────────────────────────────────────────────────────
function ViennaMap({ showCorridor, mapApiRef }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const corridorRef = useRef(null);
  const destMarkerRef = useRef(null);

  useEffect(() => {
    if (!window.L || !containerRef.current || mapRef.current) return;

    const map = window.L.map(containerRef.current, {
      center: CURRENT_LOCATION,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
      touchZoom: true,
    });

    window.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    // Freeform polygon overlays (per zone) — irregular blobs instead of circles
    HEATMAP_ZONES.forEach(z => {
      window.L.polygon(freeformBlob([z.lat, z.lng], z.radius, z.seed), {
        color: z.color,
        weight: 0,
        fillColor: z.color,
        fillOpacity: 0.35,
        smoothFactor: 0.4,
        interactive: false,
      }).addTo(map);
    });

    // Current location marker (pulsing dot, neutral white-on-purple to avoid
    // confusion with the green/red air-quality palette)
    const pulseIcon = window.L.divIcon({
      className: '',
      html: `
        <div class="aa-marker">
          <div class="aa-marker-pulse"></div>
          <div class="aa-marker-dot"></div>
        </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    window.L.marker(CURRENT_LOCATION, { icon: pulseIcon }).addTo(map);

    mapRef.current = map;
    if (mapApiRef) {
      mapApiRef.current = {
        zoomIn: () => map.zoomIn(),
        zoomOut: () => map.zoomOut(),
      };
    }
    return () => {
      map.remove();
      mapRef.current = null;
      if (mapApiRef) mapApiRef.current = null;
    };
  }, []);

  // Toggle Green Corridor + destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;

    if (showCorridor) {
      if (!corridorRef.current) {
        // Casing (white outline) + green line on top, drawn together
        const casing = window.L.polyline(GREEN_CORRIDOR, {
          color: '#ffffff', weight: 11, opacity: 0.9, lineCap: 'round', lineJoin: 'round',
        });
        const line = window.L.polyline(GREEN_CORRIDOR, {
          color: '#10B981', weight: 7, opacity: 1, lineCap: 'round', lineJoin: 'round',
        });
        const group = window.L.layerGroup([casing, line]).addTo(map);
        corridorRef.current = group;

        const destIcon = window.L.divIcon({
          className: '',
          html: `<div class="aa-pin"><div class="aa-pin-inner"></div></div>`,
          iconSize: [22, 28],
          iconAnchor: [11, 26],
        });
        destMarkerRef.current = window.L.marker(DEST_SPENGERGASSE, { icon: destIcon }).addTo(map);
      }
    } else {
      if (corridorRef.current) {
        map.removeLayer(corridorRef.current);
        corridorRef.current = null;
      }
      if (destMarkerRef.current) {
        map.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
    }
  }, [showCorridor]);

  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#E8ECEE' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Phone screen — header + (map | contribute), or LockScreen during simulation
// ─────────────────────────────────────────────────────────────
function PhoneScreen({ tab, setTab, simulationActive }) {
  if (simulationActive) return <LockScreen />;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      paddingTop: 54,
      display: 'flex', flexDirection: 'column',
      background: '#0F1117',
    }}>
      {/* App Header */}
      <div style={{
        background: '#0F1117',
        color: '#fff',
        padding: '14px 18px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        position: 'relative',
        zIndex: 10,
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '-0.01em',
          color: '#fff',
          fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        }}>
          AirAware
        </div>
        <TabSwitcher tab={tab} setTab={setTab} />
      </div>

      {/* Body */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {tab === 'map' ? <MapView /> : <ContributeView />}
      </div>
    </div>
  );
}

function TabSwitcher({ tab, setTab }) {
  const tabs = [
    { id: 'map', label: 'Map' },
    { id: 'contribute', label: 'Contribute' },
  ];
  return (
    <div style={{
      display: 'flex',
      background: 'rgba(255,255,255,0.07)',
      borderRadius: 999,
      padding: 3,
      gap: 2,
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    }}>
      {tabs.map(t => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              border: 'none',
              cursor: 'pointer',
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              color: active ? '#fff' : 'rgba(255,255,255,0.65)',
              background: active ? '#7C3AED' : 'transparent',
              boxShadow: active ? '0 1px 6px rgba(124,58,237,0.45)' : 'none',
              transition: 'all 160ms ease',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Map view: heatmap + search + routing overlay + breathe-score banner
// ─────────────────────────────────────────────────────────────
function MapView() {
  const [searchValue, setSearchValue] = useState('');
  const [routeOverlayOpen, setRouteOverlayOpen] = useState(false);
  const [routeMode, setRouteMode] = useState(null); // 'health' | 'fast'
  const mapApi = useRef(null);

  // Score is derived from the current location’s zone (none = average = blue).
  const SCORE = breatheScoreFor(CURRENT_LOCATION);

  const handleSearchClick = () => {
    setSearchValue('HTL Spengergasse');
    setRouteMode(null);
    setRouteOverlayOpen(true);
  };

  const handleRouteSelect = (mode) => {
    setRouteMode(mode);
    setRouteOverlayOpen(false);
  };

  // Cancel navigation — clears search, dismisses overlay, removes corridor.
  const handleCancel = () => {
    setSearchValue('');
    setRouteMode(null);
    setRouteOverlayOpen(false);
  };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ViennaMap showCorridor={routeMode === 'health'} mapApiRef={mapApi} />

      {/* Search bar (white, below header) */}
      <SearchBar value={searchValue} onClick={handleSearchClick} onCancel={handleCancel} />

      {/* Zoom controls (right side, above the banner) */}
      <ZoomControls
        onZoomIn={() => mapApi.current?.zoomIn()}
        onZoomOut={() => mapApi.current?.zoomOut()}
      />

      {/* Routing selection overlay */}
      {routeOverlayOpen && (
        <RouteOverlay onSelect={handleRouteSelect} onDismiss={() => setRouteOverlayOpen(false)} />
      )}

      {/* Breathe-score card (floating at bottom) */}
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 28, zIndex: 15,
      }}>
        <BreatheScoreCard score={SCORE} />
      </div>

      {/* Marker styles */}
      <style>{`
        .aa-marker { position: relative; width: 24px; height: 24px; }
        .aa-marker-dot {
          position: absolute; inset: 6px; border-radius: 999px;
          background: #7C3AED;
          border: 2.5px solid #fff;
          box-shadow: 0 2px 6px rgba(15,17,23,0.25);
        }
        .aa-marker-pulse {
          position: absolute; inset: 0; border-radius: 999px;
          background: rgba(124,58,237,0.35);
          animation: aa-pulse 1.8s ease-out infinite;
        }
        @keyframes aa-pulse {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .aa-pin {
          width: 22px; height: 28px; position: relative;
          filter: drop-shadow(0 3px 6px rgba(15,17,23,0.25));
        }
        .aa-pin::before {
          content: ''; position: absolute; top: 0; left: 0;
          width: 22px; height: 22px; border-radius: 50%;
          background: #10B981; border: 2.5px solid #fff;
        }
        .aa-pin::after {
          content: ''; position: absolute; left: 50%; top: 16px;
          transform: translateX(-50%) rotate(45deg);
          width: 10px; height: 10px; background: #10B981;
          border-right: 2.5px solid #fff; border-bottom: 2.5px solid #fff;
        }
        .aa-pin-inner {
          position: absolute; top: 7px; left: 7px;
          width: 8px; height: 8px; border-radius: 50%; background: #fff;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Search bar — white, below header. Click → simulates HTL Spengergasse.
// ─────────────────────────────────────────────────────────────
function SearchBar({ value, onClick, onCancel }) {
  const hasValue = !!value;
  return (
    <div style={{
      position: 'absolute', top: 14, left: 14, right: 14, zIndex: 20,
    }}>
      <div
        style={{
          width: '100%',
          height: 44,
          background: '#fff',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 14,
          paddingRight: hasValue ? 4 : 14,
          boxShadow: '0 6px 18px rgba(15,17,23,0.12), 0 1px 2px rgba(15,17,23,0.06)',
          fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        }}
      >
        <button
          onClick={onClick}
          aria-label="Search"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            flex: 1, height: '100%', minWidth: 0,
            background: 'transparent', border: 'none',
            padding: 0, textAlign: 'left', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flex: 'none' }}>
            <circle cx="11" cy="11" r="7" stroke="#6B6F76" strokeWidth="2"/>
            <path d="M20 20l-3.5-3.5" stroke="#6B6F76" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{
            fontSize: 14,
            color: hasValue ? '#0F1117' : '#9CA0A6',
            fontWeight: hasValue ? 500 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {value || 'Search...'}
          </span>
        </button>
        {hasValue && (
          <button
            onClick={onCancel}
            aria-label="Cancel navigation"
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: '#F1F0EC',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flex: 'none',
              transition: 'background 140ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#E6E5E0'}
            onMouseLeave={e => e.currentTarget.style.background = '#F1F0EC'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="#6B6F76" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Zoom controls — vertical +/- pair on the right side of the map
// ─────────────────────────────────────────────────────────────
function ZoomControls({ onZoomIn, onZoomOut }) {
  return (
    <div style={{
      position: 'absolute',
      right: 14, bottom: 96, zIndex: 20,
      display: 'flex', flexDirection: 'column',
      background: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 6px 18px rgba(15,17,23,0.12), 0 1px 2px rgba(15,17,23,0.06)',
    }}>
      <ZoomBtn onClick={onZoomIn} label="Zoom in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="#0F1117" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </ZoomBtn>
      <div style={{ height: 1, background: 'rgba(15,17,23,0.08)' }} />
      <ZoomBtn onClick={onZoomOut} label="Zoom out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14" stroke="#0F1117" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </ZoomBtn>
    </div>
  );
}

function ZoomBtn({ children, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 40, height: 40, border: 'none', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'background 140ms ease',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#F5F4F0'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Route selection overlay — two options as specified.
// ─────────────────────────────────────────────────────────────
function RouteOverlay({ onSelect, onDismiss }) {
  return (
    <>
      {/* Scrim */}
      <div
        onClick={onDismiss}
        style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(15,17,23,0.35)',
          animation: 'aa-fade 180ms ease-out',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'absolute',
        left: 14, right: 14, bottom: 86,
        zIndex: 31,
        background: '#fff',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 20px 50px rgba(15,17,23,0.25)',
        animation: 'aa-rise 220ms cubic-bezier(.2,.8,.2,1)',
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: '#6B6F76',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
        }}>
          Choose your route
        </div>

        <RouteOption
          accent="#10B981"
          label="Health priority route"
          sub="Avoids high-pollution zones"
          onClick={() => onSelect('health')}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10h-4z" fill="#10B981"/>
            </svg>
          )}
        />
        <div style={{ height: 8 }} />
        <RouteOption
          accent="#7C3AED"
          label="Fastest route"
          sub="Shortest travel time"
          onClick={() => onSelect('fast')}
          icon={(
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#7C3AED"/>
            </svg>
          )}
        />
      </div>

      <style>{`
        @keyframes aa-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aa-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function RouteOption({ accent, label, sub, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 12px',
        background: '#F6F5F2',
        border: '1px solid rgba(15,17,23,0.04)',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 140ms ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#EFEDE8'}
      onMouseLeave={e => e.currentTarget.style.background = '#F6F5F2'}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 'none',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F1117', lineHeight: 1.2 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: '#6B6F76', marginTop: 2 }}>{sub}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="#9CA0A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Breathe-Score banner — fixed bottom; color + icon driven by score
// 91 → green smile, 69 → blue neutral, 45 → orange slightly-sad, 12 → red sad
// ─────────────────────────────────────────────────────────────
function scoreVariant(score) {
  if (score >= 80) return { bg: '#10B981', face: 'happy', text: '#fff' };
  if (score >= 60) return { bg: '#3B82F6', face: 'neutral', text: '#fff' };
  if (score >= 30) return { bg: '#F97316', face: 'slightSad', text: '#fff' };
  return { bg: '#EF4444', face: 'sad', text: '#fff' };
}

function FaceIcon({ kind, color = '#fff' }) {
  // Simple, legible faces. Outer circle + eyes + mouth.
  const stroke = color;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={stroke} strokeWidth="1.8"/>
      <circle cx="9" cy="10" r="1.1" fill={stroke}/>
      <circle cx="15" cy="10" r="1.1" fill={stroke}/>
      {kind === 'happy' && (
        <path d="M8 14c1 1.6 2.5 2.4 4 2.4S15 15.6 16 14" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      )}
      {kind === 'neutral' && (
        <path d="M8.5 15h7" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      )}
      {kind === 'slightSad' && (
        <path d="M8.5 15.4c1-0.8 2.2-1.2 3.5-1.2s2.5 0.4 3.5 1.2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      )}
      {kind === 'sad' && (
        <path d="M8 16c1-1.6 2.5-2.4 4-2.4S15 14.4 16 16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      )}
    </svg>
  );
}

function BreatheScoreCard({ score }) {
  const v = scoreVariant(score);
  return (
    <div style={{
      backgroundColor: v.bg,
      color: v.text,
      padding: '12px 14px',
      borderRadius: 16,
      display: 'flex', alignItems: 'center', gap: 12,
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      boxShadow: '0 10px 24px rgba(15,17,23,0.18), 0 1px 0 rgba(255,255,255,0.05) inset',
      transition: 'background-color 360ms ease',
    }}>
      <FaceIcon kind={v.face} color={v.text}/>
      <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.25 }}>
        <span style={{ opacity: 0.92 }}>Your local breathe score is at: </span>
        <span style={{ fontWeight: 700 }}>{score}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Contribute view — sensor selection → live data trail → thank-you
// (Task 3: Data Contribution)
// ─────────────────────────────────────────────────────────────
const TRAIL_PATH = [
  [48.2082, 16.3738],
  [48.2076, 16.3758],
  [48.2068, 16.3778],
  [48.2058, 16.3800],
  [48.2050, 16.3826],
  [48.2040, 16.3848],
  [48.2028, 16.3862],
  [48.2016, 16.3868],
  [48.2006, 16.3855],
  [48.2000, 16.3832],
  [48.1998, 16.3808],
];

function ContributeView() {
  const [sensor, setSensor] = useState('');
  const [phase, setPhase] = useState('idle'); // 'idle' | 'running' | 'done'

  const startEnabled = !!sensor;

  const handleStart = () => { if (startEnabled) setPhase('running'); };
  const handleStop = () => setPhase('done');
  const handleDismiss = () => { setPhase('idle'); setSensor(''); };

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ContributeMap running={phase === 'running'} />

      {/* Status banner (running only) */}
      {phase === 'running' && (
        <div style={{
          position: 'absolute', top: 14, left: 14, right: 14, zIndex: 20,
          background: '#fff',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 6px 18px rgba(15,17,23,0.12), 0 1px 2px rgba(15,17,23,0.06)',
          fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
        }}>
          <span className="aa-data-pulse" style={{
            width: 10, height: 10, borderRadius: 999, background: '#10B981',
            flex: 'none',
          }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#0F1117' }}>
            Currently data is being transferred
          </span>
        </div>
      )}

      {/* Bottom card: dropdown + Start, or Stop */}
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 38, zIndex: 20,
        background: '#fff',
        borderRadius: 18,
        padding: 16,
        boxShadow: '0 12px 30px rgba(15,17,23,0.14), 0 1px 2px rgba(15,17,23,0.06)',
        fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      }}>
        {phase !== 'running' ? (
          <>
            <SensorDropdown value={sensor} onChange={setSensor} />
            <button
              onClick={handleStart}
              disabled={!startEnabled}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '13px',
                borderRadius: 12,
                border: 'none',
                cursor: startEnabled ? 'pointer' : 'not-allowed',
                background: startEnabled ? '#7C3AED' : '#E6E5E0',
                color: startEnabled ? '#fff' : '#9CA0A6',
                fontFamily: 'inherit',
                fontSize: 15, fontWeight: 600,
                boxShadow: startEnabled ? '0 6px 14px rgba(124,58,237,0.32)' : 'none',
                transition: 'all 180ms ease',
              }}
            >
              Start
            </button>
          </>
        ) : (
          <button
            onClick={handleStop}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              background: '#6B6F76',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 15, fontWeight: 600,
              boxShadow: '0 6px 14px rgba(15,17,23,0.18)',
            }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Thank-you overlay */}
      {phase === 'done' && <ThankYouOverlay onDismiss={handleDismiss} />}

      <style>{`
        @keyframes aa-data-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); }
          50%      { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
        .aa-data-pulse { animation: aa-data-pulse 1.4s ease-out infinite; }
      `}</style>
    </div>
  );
}

function SensorDropdown({ value, onChange }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#6B6F76',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 6,
      }}>
        Sensor
      </div>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            background: '#F6F5F2',
            border: '1px solid rgba(15,17,23,0.06)',
            borderRadius: 12,
            padding: '12px 40px 12px 14px',
            fontSize: 14, fontWeight: 500,
            color: value ? '#0F1117' : '#9CA0A6',
            fontFamily: 'inherit',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">Select a sensor</option>
          <option value="Sensor kit 1">Sensor kit 1</option>
          <option value="Sensor kit 2">Sensor kit 2</option>
          <option value="Sensor kit 3">Sensor kit 3</option>
        </select>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <path d="M6 9l6 6 6-6" stroke="#6B6F76" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </label>
  );
}

function ThankYouOverlay({ onDismiss }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(15,17,23,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      animation: 'aa-fade 200ms ease-out',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '28px 24px 22px',
        textAlign: 'center',
        maxWidth: 320, width: '100%',
        boxShadow: '0 24px 60px rgba(15,17,23,0.35)',
        animation: 'aa-rise 260ms cubic-bezier(.2,.8,.2,1)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 999,
          background: '#10B981',
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(16,185,129,0.35)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{
          fontSize: 17, fontWeight: 600, color: '#0F1117',
          letterSpacing: '-0.01em', marginBottom: 18,
          lineHeight: 1.35,
        }}>
          Thank you, for your contribution!
        </div>
        <button
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: '#7C3AED',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 14, fontWeight: 600,
            boxShadow: '0 6px 14px rgba(124,58,237,0.30)',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ContributeMap({ running }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!window.L || !containerRef.current || mapRef.current) return;
    const map = window.L.map(containerRef.current, {
      zoomControl: false, attributionControl: false,
      dragging: true, scrollWheelZoom: false,
      doubleClickZoom: true, touchZoom: true,
    });
    window.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    map.fitBounds(window.L.latLngBounds(TRAIL_PATH), { padding: [60, 60] });

    const icon = window.L.divIcon({
      className: '',
      html: '<div class="aa-marker"><div class="aa-marker-pulse"></div><div class="aa-marker-dot"></div></div>',
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    markerRef.current = window.L.marker(TRAIL_PATH[0], { icon }).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Trail animation while running
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.L) return;

    if (!running) {
      markerRef.current?.setLatLng(TRAIL_PATH[0]);
      return;
    }

    markerRef.current?.setLatLng(TRAIL_PATH[0]);

    const casing = window.L.polyline([TRAIL_PATH[0]], {
      color: '#fff', weight: 10, opacity: 0.9,
      lineCap: 'round', lineJoin: 'round',
    }).addTo(map);
    const trail = window.L.polyline([TRAIL_PATH[0]], {
      color: '#10B981', weight: 6, opacity: 1,
      lineCap: 'round', lineJoin: 'round',
    }).addTo(map);

    let idx = 0;
    const id = setInterval(() => {
      idx = Math.min(idx + 1, TRAIL_PATH.length - 1);
      const slice = TRAIL_PATH.slice(0, idx + 1);
      casing.setLatLngs(slice);
      trail.setLatLngs(slice);
      markerRef.current?.setLatLng(TRAIL_PATH[idx]);
      if (idx === TRAIL_PATH.length - 1) clearInterval(id);
    }, 1100);

    return () => {
      clearInterval(id);
      map.removeLayer(casing);
      map.removeLayer(trail);
    };
  }, [running]);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#E8ECEE' }}>
      <style>{`
        .aa-marker { position: relative; width: 24px; height: 24px; }
        .aa-marker-dot {
          position: absolute; inset: 6px; border-radius: 999px;
          background: #7C3AED;
          border: 2.5px solid #fff;
          box-shadow: 0 2px 6px rgba(15,17,23,0.25);
        }
        .aa-marker-pulse {
          position: absolute; inset: 0; border-radius: 999px;
          background: rgba(124,58,237,0.35);
          animation: aa-pulse 1.8s ease-out infinite;
        }
        @keyframes aa-pulse {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Lock Screen + AirAware warning widget (Task 2: Proactive Alerts)
//
// Simulation arc: marker starts in a neutral zone (blue/safe theme,
// 91% smile) and moves along a path into a red pollution hotspot.
// Once it enters the red zone, the widget theme + score + face flip
// to the danger state (red/36%/sad) and the heartbeat intensifies.
// ─────────────────────────────────────────────────────────────
const SIM_START = [48.2058, 16.3722];
const SIM_END   = [48.2028, 16.3695]; // also the heatmap center
const SIM_PATH = [
  SIM_START,
  [48.2052, 16.3716],
  [48.2046, 16.3710],
  [48.2040, 16.3705],
  [48.2034, 16.3700],
  SIM_END,
];

function pathAt(t, points) {
  if (t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];
  const segs = points.length - 1;
  const seg = Math.min(Math.floor(t * segs), segs - 1);
  const local = (t * segs) - seg;
  const a = points[seg], b = points[seg + 1];
  return [a[0] + (b[0] - a[0]) * local, a[1] + (b[1] - a[1]) * local];
}

function LockScreen() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(168deg, #1a1f2e 0%, #0a0c14 55%, #0a0c14 100%)',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* subtle wallpaper glow */}
      <div style={{
        position: 'absolute', top: -120, left: -60, width: 360, height: 360,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0) 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute', inset: 0,
        paddingTop: 78,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          color: '#fff',
          fontWeight: 200,
          fontSize: 92,
          letterSpacing: '-0.045em',
          lineHeight: 1,
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          marginTop: 14,
        }}>
          14:18
        </div>

        <div style={{ width: '100%', padding: '40px 16px 0' }}>
          <DangerZoneWidget />
        </div>
      </div>
    </div>
  );
}

function DangerZoneWidget() {
  // Only TWO renders ever: mount (safe) + danger flip. The marker
  // animation is owned by <MiniMap> imperatively so we don't trigger
  // 60fps re-renders here that would stomp on the score box's CSS
  // background-color transition.
  const [danger, setDanger] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDanger(true), 4340); // 7000ms * 0.62
    return () => clearTimeout(id);
  }, []);

  const score = danger ? 36 : 91;
  const theme = danger
    ? { face: 'sad',   broadcast: '#EF4444' }
    : { face: 'happy', broadcast: '#94A3B8' };

  return (
    <div className={danger ? 'aa-widget aa-widget-danger' : 'aa-widget aa-widget-safe'} style={{
      width: '100%',
      borderRadius: 22,
      padding: 14,
      backgroundColor: 'rgba(252,250,246,0.96)',
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid rgba(0,0,0,0.05)',
      color: '#0F1117',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    }}>
      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F1117', letterSpacing: '-0.01em' }}>
          AirAware
        </div>
        <BroadcastIcon color={theme.broadcast} />
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 12.5,
        color: '#3A3D45',
        marginBottom: 10,
        fontWeight: 500,
      }}>
        Currently monitoring your surroundings.
      </div>

      {/* Body row */}
      <div style={{ display: 'flex', gap: 10, height: 96 }}>
        <div style={{
          flex: 1,
          borderRadius: 14, overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)',
        }}>
          <MiniMap />
        </div>

        <div
          className={danger ? 'aa-score-box aa-score-box-danger' : 'aa-score-box aa-score-box-safe'}
          style={{
            flex: 1,
            borderRadius: 14,
            padding: '10px 12px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            border: '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FaceIcon kind={theme.face} color="#0F1117" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0F1117', letterSpacing: '-0.005em' }}>
              Breathe score
            </span>
          </div>
          <div style={{
            fontSize: 30, fontWeight: 800, color: '#0F1117',
            letterSpacing: '-0.03em', lineHeight: 1,
          }}>
            {score}%
          </div>
        </div>
      </div>

      <style>{`
        @keyframes aa-heartbeat-safe {
          0%, 100% { transform: scale(1); }
          14%      { transform: scale(1.006); }
          28%      { transform: scale(1); }
          42%      { transform: scale(1.004); }
          56%      { transform: scale(1); }
        }
        @keyframes aa-heartbeat-danger {
          0%   { transform: scale(1);     box-shadow: 0 18px 40px rgba(0,0,0,0.18), 0 0 0 0 rgba(239,68,68,0.50); }
          12%  { transform: scale(1.022); box-shadow: 0 18px 40px rgba(0,0,0,0.18), 0 0 0 12px rgba(239,68,68,0.00); }
          24%  { transform: scale(1); }
          36%  { transform: scale(1.014); }
          48%  { transform: scale(1); }
          100% { transform: scale(1);     box-shadow: 0 18px 40px rgba(0,0,0,0.18), 0 0 0 0 rgba(239,68,68,0); }
        }
        .aa-widget { transform-origin: center; will-change: transform; box-shadow: 0 18px 40px rgba(0,0,0,0.18); }
        .aa-widget-safe   { animation: aa-heartbeat-safe   2.2s ease-in-out infinite; }
        .aa-widget-danger { animation: aa-heartbeat-danger 1.4s ease-in-out infinite; }
        .aa-score-box        { transition: background-color 360ms ease; }
        .aa-score-box-safe   { background-color: #DCE9F5; }
        .aa-score-box-danger { background-color: #F8DEDE; }
      `}</style>
    </div>
  );
}

function BroadcastIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ transition: 'color 360ms ease', color }}>
      <circle cx="12" cy="12" r="2" fill={color}/>
      <path d="M9 9a4.5 4.5 0 0 1 6 0" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M6 6a9 9 0 0 1 12 0" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M9 15a4.5 4.5 0 0 0 6 0" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <path d="M6 18a9 9 0 0 0 12 0" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

function MiniMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!window.L || !containerRef.current) return;
    const map = window.L.map(containerRef.current, {
      center: SIM_END, zoom: 15,
      zoomControl: false, attributionControl: false,
      dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false,
      keyboard: false, boxZoom: false,
    });
    window.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    // Heatmap blob — concentric circles to mimic a contour gradient
    window.L.circle(SIM_END, { radius: 140, color: '#10B981', weight: 0, fillColor: '#10B981', fillOpacity: 0.28, interactive: false }).addTo(map);
    window.L.circle(SIM_END, { radius: 95,  color: '#FACC15', weight: 0, fillColor: '#FACC15', fillOpacity: 0.55, interactive: false }).addTo(map);
    window.L.circle(SIM_END, { radius: 60,  color: '#F97316', weight: 0, fillColor: '#F97316', fillOpacity: 0.6,  interactive: false }).addTo(map);
    window.L.circle(SIM_END, { radius: 30,  color: '#EF4444', weight: 0, fillColor: '#EF4444', fillOpacity: 0.7,  interactive: false }).addTo(map);

    const HEAT_PAD_LAT = 0.0014;
    const HEAT_PAD_LNG = 0.0021;
    const bounds = window.L.latLngBounds([
      SIM_START,
      SIM_END,
      [SIM_END[0] - HEAT_PAD_LAT, SIM_END[1] - HEAT_PAD_LNG],
      [SIM_END[0] + HEAT_PAD_LAT, SIM_END[1] + HEAT_PAD_LNG],
    ]);
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [4, 4], animate: false });
    });

    const icon = window.L.divIcon({
      className: '',
      html: '<div class="aa-mini-pin"></div>',
      iconSize: [14, 18], iconAnchor: [7, 16],
    });
    markerRef.current = window.L.marker(SIM_PATH[0], { icon, interactive: false }).addTo(map);

    // Drive the marker animation imperatively — NO React state, so the
    // parent widget never re-renders during the animation and CSS
    // transitions on sibling elements aren't disturbed.
    let raf, t0;
    const tick = (now) => {
      if (t0 == null) t0 = now;
      const p = Math.min((now - t0) / 7000, 1);
      markerRef.current?.setLatLng(pathAt(p, SIM_PATH));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    mapRef.current = map;
    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#E8ECEE' }}>
      <style>{`
        .aa-mini-pin {
          position: relative;
          width: 14px; height: 18px;
          filter: drop-shadow(0 2px 3px rgba(15,17,23,0.35));
        }
        .aa-mini-pin::before {
          content: ''; position: absolute; top: 0; left: 0;
          width: 14px; height: 14px; border-radius: 50%;
          background: #6D28D9; border: 2px solid #fff;
        }
        .aa-mini-pin::after {
          content: ''; position: absolute; left: 50%; top: 9px;
          transform: translateX(-50%) rotate(45deg);
          width: 7px; height: 7px; background: #6D28D9;
          border-right: 2px solid #fff; border-bottom: 2px solid #fff;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Info Panel (right column) + toggle button
// ─────────────────────────────────────────────────────────────
const INFO_COPY = {
  map: {
    eyebrow: 'Task 1',
    title: 'Finding a low-pollution route',
    body: 'May checks the Breathe-Score and enters her destination. She selects the Health-Priority option to see the Green Corridor, which guides her safely through the city.',
  },
  task2: {
    eyebrow: 'Task 2',
    title: 'Proactive Alerts',
    body: 'Even when the app is in the background, the system monitors air quality. Entering a hazardous area triggers a haptic vibration and a visual lock-screen alert, allowing users to react instantly without unlocking their phone.',
  },
  contribute: {
    eyebrow: 'Task 3',
    title: 'Data Contribution',
    body: 'Delivery drivers connect mobile sensors to improve the network. The Start button is only available once a sensor is connected. A green data-trail confirms the transmission, followed by a thank-you message upon completion.',
  },
};

function InfoPanel({ tab, open, onClose, simulationActive, onToggleSimulation }) {
  const copy = simulationActive
    ? INFO_COPY.task2
    : INFO_COPY[tab];

  const showSimulateButton = tab === 'map' || simulationActive;

  return (
    <aside
      className={`transition-all duration-300 ease-out ${open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}
      style={{
        width: 360,
        background: '#fff',
        borderRadius: 20,
        padding: 28,
        boxShadow: '0 1px 0 rgba(15,17,23,0.04), 0 24px 48px -16px rgba(15,17,23,0.16)',
        border: '1px solid rgba(15,17,23,0.06)',
        position: 'relative',
        alignSelf: 'flex-start',
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-neutral-400 mb-2">
            {copy.eyebrow}
          </div>
          <div className="text-xl font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em', lineHeight: 1.25 }}>
            {copy.title}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Hide info panel"
          className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-500 hover:bg-neutral-100 transition-colors flex-none"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <p className="text-[14px] leading-[1.65] text-neutral-600">
        {copy.body}
      </p>

      {showSimulateButton && (
        <button
          onClick={onToggleSimulation}
          style={{
            marginTop: 22,
            width: '100%',
            padding: '12px 16px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            background: simulationActive ? '#0F1117' : '#7C3AED',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '-0.005em',
            boxShadow: simulationActive
              ? '0 1px 0 rgba(0,0,0,0.04), 0 6px 16px rgba(15,17,23,0.18)'
              : '0 1px 0 rgba(0,0,0,0.04), 0 6px 16px rgba(124,58,237,0.32)',
            transition: 'transform 120ms ease, background 200ms ease',
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.985)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {simulationActive ? 'Exit Simulation' : 'Simulate Danger Zone'}
        </button>
      )}
    </aside>
  );
}

function InfoToggleButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Show info panel"
      className="w-11 h-11 rounded-full bg-white border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 transition-colors"
      style={{ boxShadow: '0 1px 0 rgba(15,17,23,0.04), 0 8px 20px rgba(15,17,23,0.08)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M12 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="7.6" r="1.1" fill="currentColor"/>
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
function App() {
  const [tab, setTab] = useState('map');
  const [infoOpen, setInfoOpen] = useState(true);
  const [simulationActive, setSimulationActive] = useState(false);

  return (
    <div className="min-h-screen w-full" style={{ background: '#F4F2EE', fontFamily: 'Inter, -apple-system, system-ui, sans-serif' }}>
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: '#7C3AED',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: '#fff' }} />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>AirAware Vienna</div>
              <div className="text-[12px] text-neutral-500">Prototype preview</div>
            </div>
          </div>
          {!infoOpen && <InfoToggleButton onClick={() => setInfoOpen(true)} />}
        </header>

        {/* Two-column layout */}
        <div className="flex items-center justify-center gap-12 flex-wrap lg:flex-nowrap">
          {/* Phone */}
          <div className="flex-shrink-0">
            <IOSDevice
              width={390}
              height={844}
              dark={true}
              statusBarTime={simulationActive ? '14:18' : undefined}
            >
              <PhoneScreen tab={tab} setTab={setTab} simulationActive={simulationActive} />
            </IOSDevice>
          </div>

          {/* Info panel */}
          <div className="flex-shrink-0">
            <InfoPanel
              tab={tab}
              open={infoOpen}
              onClose={() => setInfoOpen(false)}
              simulationActive={simulationActive}
              onToggleSimulation={() => setSimulationActive(v => !v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

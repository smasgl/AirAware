// Screens: Map tab, Contribute tab, Lock screen (Leaflet-based)
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

// ──────────────── APP HEADER ────────────────
function AppHeader({ tab, onTabChange }) {
  const Tab = ({ id, label }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => onTabChange(id)}
        style={{
          padding: '7px 14px',
          borderRadius: 999,
          background: active ? AA.COLORS.primary : 'transparent',
          color: active ? '#fff' : 'rgba(255,255,255,0.7)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: -0.1,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}>
        {label}
      </button>);

  };
  return (
    <div style={{
      position: 'absolute', top: 76, left: 0, right: 0, zIndex: 30,
      padding: '0 16px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 44
    }}>
      <div style={{
        background: 'rgba(20,20,25,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 999,
        padding: '6px 8px 6px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        flex: 1,
        boxShadow: '0 4px 18px rgba(0,0,0,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.08)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1,
          color: '#fff', fontWeight: 700, letterSpacing: -0.3, fontSize: "20px"
        }}>
          <LogoDot />
          <span style={{ fontSize: "15px" }}>AirAware</span>
        </div>
        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: 3 }}>
          <Tab id="map" label="Map" />
          <Tab id="contribute" label="Contribute" />
        </div>
      </div>
    </div>);

}

function LogoDot() {
  // Wind / air-current glyph — three soft waves to read as “air” at small sizes.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24">
      <defs>
        <radialGradient id="logoGrad" cx="0.3" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#6d28d9" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#logoGrad)" />
      <g fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
        <path d="M5 9 H14 a2 2 0 1 0 -2 -2" />
        <path d="M5 13 H17 a2.4 2.4 0 1 1 -2.4 2.4" />
        <path d="M5 17 H10" />
      </g>
    </svg>);

}

// ──────────────── SEARCH BAR ────────────────
function SearchBar({ value, placeholder, onClick, focused }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute', top: 132, left: 16, right: 16, zIndex: 25,
        background: '#fff',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        border: focused ? `2px solid ${AA.COLORS.primary}` : '2px solid transparent'
      }}>
      <AA.Icon.search style={{ color: '#71717a' }} />
      <div style={{
        flex: 1, fontSize: 15, color: value ? '#111' : '#a1a1aa',
        fontWeight: value ? 500 : 400, letterSpacing: -0.2
      }}>
        {value || placeholder}
      </div>
      {value &&
      <div style={{ color: '#a1a1aa', fontSize: 12 }}>2.1 km</div>
      }
    </div>);

}

// ──────────────── BREATHE BANNER ────────────────
function BreatheBanner({ score, contribute = false }) {
  const theme = AA.scoreTheme(score);
  const IconC = AA.Icon[theme.icon];
  return (
    <div style={{
      position: 'absolute', bottom: 28, left: 16, right: 16, zIndex: 25,
      background: theme.bg, color: theme.text,
      borderRadius: 18,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 12px 28px ${theme.bg}55, 0 2px 6px rgba(0,0,0,0.18)`
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff'
      }}>
        <IconC s={26} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, letterSpacing: 0.2, textTransform: 'uppercase' }}>
          {contribute ? 'Area you’re covering' : 'Your local'}
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.3, lineHeight: 1.2 }}>
          Breathe score is at: <span style={{ fontWeight: 800 }}>{score}%</span>
        </div>
      </div>
      <div style={{
        fontSize: 11, opacity: 0.85, fontWeight: 600, letterSpacing: 0.3,
        padding: '4px 8px', background: 'rgba(255,255,255,0.16)', borderRadius: 6
      }}>
        {theme.label.toUpperCase()}
      </div>
    </div>);

}

// ──────────────── ROUTE PICKER OVERLAY ────────────────
function RoutePicker({ destination, onChoose, onCancel }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(2px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 18px 36px',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.18)'
      }}>
        <div style={{
          width: 38, height: 4, background: '#e4e4e7', borderRadius: 2,
          margin: '0 auto 16px'
        }} />
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 11, color: '#71717a', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>Destination</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#111', letterSpacing: -0.4, marginTop: 2 }}>{destination}</div>
          </div>
          <button onClick={onCancel} style={{
            width: 30, height: 30, borderRadius: 999, border: 'none',
            background: '#f4f4f5', color: '#52525b', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><AA.Icon.close s={14} /></button>
        </div>
        <div style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>Choose how you want to travel.</div>

        <button
          onClick={() => onChoose('health')}
          style={{
            width: '100%', textAlign: 'left',
            background: '#f7f5ff',
            border: `1.5px solid ${AA.COLORS.primary}`,
            borderRadius: 16, padding: '14px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 10, cursor: 'pointer'
          }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: AA.COLORS.primary, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><AA.Icon.shield s={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Health priority route</div>
              <span style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 4,
                background: AA.COLORS.primary, color: '#fff', fontWeight: 700, letterSpacing: 0.3
              }}>RECOMMENDED</span>
            </div>
            <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>
              17 min · 1.4 km · avoids red zones
            </div>
          </div>
        </button>

        <button
          onClick={() => onChoose('fastest')}
          style={{
            width: '100%', textAlign: 'left',
            background: '#fafafa',
            border: '1.5px solid #e4e4e7',
            borderRadius: 16, padding: '14px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer'
          }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: '#fafafa', color: '#52525b', border: '1px solid #e4e4e7',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}><AA.Icon.lightning s={20} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>Fastest route</div>
            <div style={{ fontSize: 12, color: '#52525b', marginTop: 2 }}>
              13 min · 1.2 km · passes red zones
            </div>
          </div>
        </button>
      </div>
    </div>);

}

// ──────────────── MAP TAB ────────────────
function MapTab({ mapState, setMapState, route, setRoute, searchValue, setSearchValue }) {
  // Score reflects the user's CURRENT position on the map (the user marker
  // doesn't move when picking a route — they're still at home).
  const score = AA.scoreForPosition(AA.USER_POS, AA.HOTSPOTS);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* Map background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <LeafletMap
          center={AA.USER_POS}
          zoom={16.2}
          hotspots={AA.HOTSPOTS}
          userPos={AA.USER_POS}
          destinationPos={mapState !== 'idle' ? AA.DEST_POS : null}
          route={route === 'health' ? AA.HEALTH_ROUTE : route === 'fastest' ? AA.FASTEST_ROUTE : null}
          routeColor={route === 'fastest' ? 'red' : 'green'}
          fitBounds={mapState === 'routing' ? (route === 'health' ? AA.HEALTH_ROUTE : AA.FASTEST_ROUTE) : null}
          fitBoundsPadding={[60, 60]}
          pulseUser={true} />
        
      </div>

      <SearchBar
        value={searchValue}
        placeholder="Search..."
        onClick={() => {
          if (!searchValue) {
            setMapState('typing');
            setSearchValue('HTL Spengergasse');
            setTimeout(() => setMapState('picker'), 600);
          }
        }}
        focused={mapState === 'typing'} />
      

      {mapState === 'picker' &&
      <RoutePicker
        destination="HTL Spengergasse"
        onChoose={(r) => {setRoute(r);setMapState('routing');}}
        onCancel={() => {setMapState('idle');setSearchValue('');}} />

      }

      {mapState === 'routing' && (route === 'health' || route === 'fastest') &&
      <div style={{
        position: 'absolute', top: 132, left: 16, right: 16, zIndex: 25,
        background: '#fff', borderRadius: 16, padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.14)'
      }}>
          <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: route === 'health' ? '#dcfce7' : '#fee2e2',
          color: route === 'health' ? '#16a34a' : '#dc2626',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {route === 'health' ? <AA.Icon.shield s={20} /> : <AA.Icon.lightning s={20} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111', letterSpacing: -0.2 }}>
              {route === 'health' ? 'Green corridor active' : 'Direct route active'}
            </div>
            <div style={{ fontSize: 12, color: '#52525b' }}>
              {route === 'health' ? '17 min walk · HTL Spengergasse' : '13 min walk · passes red zones'}
            </div>
          </div>
          <button onClick={() => {setMapState('idle');setRoute(null);setSearchValue('');}} style={{
          border: 'none', background: '#f4f4f5', color: '#52525b',
          padding: '7px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer'
        }}>End</button>
        </div>
      }

      <BreatheBanner score={score} />
    </div>);

}

// ──────────────── CONTRIBUTE TAB ────────────────
function ContributeTab({ phase, setPhase, sensor, setSensor }) {
  const [showDropdown, setShowDropdown] = useStateS(false);

  const [userPos, setUserPos] = useStateS(AA.USER_POS);
  const [trail, setTrail] = useStateS([]);

  // Score follows the driver's current position as they walk.
  const score = AA.scoreForPosition(userPos, AA.HOTSPOTS);

  // Smoothly interpolate along the waypoint path while running.
  // Uses setInterval at 40ms — predictable across browsers/React schedulers.
  useEffectS(() => {
    if (phase !== 'running') {
      setUserPos(AA.USER_POS);
      setTrail([]);
      return;
    }
    const path = AA.CONTRIB_WALK;
    const segmentMs = 1100;
    const tickMs = 40;
    const trailEveryMs = 240;
    const totalMs = (path.length - 1) * segmentMs;
    const startedAt = Date.now();
    let lastTrailAt = 0;
    const ease = (f) => f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    const id = setInterval(() => {
      const elapsed = Math.min(Date.now() - startedAt, totalMs);
      const t = elapsed / segmentMs;
      const i = Math.min(Math.floor(t), path.length - 2);
      const f = ease(t - i);
      const a = path[i];
      const b = path[i + 1];
      const pos = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      setUserPos(pos);
      if (elapsed - lastTrailAt >= trailEveryMs) {
        lastTrailAt = elapsed;
        // Color the sensor trail to match the breathing score at this point
        // — green when air is clean, orange/red when the driver crosses a hotspot.
        const localScore = AA.scoreForPosition(pos, AA.HOTSPOTS);
        const color = AA.scoreTheme(localScore).bg;
        setTrail((prev) => [...prev, { pos, color }]);
      }
      if (elapsed >= totalMs) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, [phase]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <LeafletMap
          center={userPos}
          zoom={16.4}
          hotspots={AA.HOTSPOTS}
          userPos={userPos}
          greenTrail={trail}
          pulseUser={phase === 'running'}
          followUser={true} />
        
      </div>

      {/* Sensor selector */}
      <div style={{
        position: 'absolute', top: 132, left: 16, right: 16, zIndex: 25
      }}>
        <button
          onClick={() => phase === 'idle' && setShowDropdown((s) => !s)}
          disabled={phase !== 'idle'}
          style={{
            width: '100%', textAlign: 'left',
            background: '#fff', border: 'none', borderRadius: 14,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 6px 24px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.06)',
            cursor: phase === 'idle' ? 'pointer' : 'default',
            opacity: phase !== 'idle' && !sensor ? 0.6 : 1
          }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: sensor ? '#dbeafe' : '#f4f4f5',
            color: sensor ? '#1d4ed8' : '#71717a',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AA.Icon.bluetooth s={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#71717a', fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>Device</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: sensor ? '#111' : '#a1a1aa', letterSpacing: -0.2 }}>
              {sensor || 'Select a sensor'}
            </div>
          </div>
          {sensor &&
          <div style={{
            fontSize: 10, padding: '3px 7px', borderRadius: 5, marginRight: 4,
            background: '#dcfce7', color: '#15803d', fontWeight: 700, letterSpacing: 0.3
          }}>CONNECTED</div>
          }
          <div style={{ color: '#a1a1aa' }}><AA.Icon.chevDown /></div>
        </button>
        {showDropdown &&
        <div style={{
          marginTop: 6, background: '#fff', borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          overflow: 'hidden'
        }}>
            {['Sensor kit 1', 'Sensor kit 2', 'Sensor kit 3 (offline)'].map((s, i) => {
            const offline = s.includes('offline');
            return (
              <button key={s}
              disabled={offline}
              onClick={() => {if (!offline) {setSensor(s);setShowDropdown(false);}}}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left',
                padding: '12px 14px',
                background: '#fff', border: 'none',
                borderTop: i ? '1px solid #f4f4f5' : 'none',
                cursor: offline ? 'not-allowed' : 'pointer',
                opacity: offline ? 0.5 : 1
              }}>
                  <AA.Icon.bluetooth s={14} style={{ color: offline ? '#a1a1aa' : '#1d4ed8' }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{s}</span>
                </button>);

          })}
          </div>
        }
      </div>

      {phase === 'running' &&
      <div style={{
        position: 'absolute', top: 200, left: 16, right: 16, zIndex: 25,
        background: '#fff', borderRadius: 14,
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 6px 24px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.06)',
        animation: 'slideDown 0.3s ease'
      }}>
          <div style={{
          width: 8, height: 8, borderRadius: 999, background: '#22c55e',
          animation: 'pulse 1.4s ease-in-out infinite'
        }} />
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: -0.1, color: '#111' }}>Currently data is being transferred</div>
        </div>
      }

      {sensor && phase !== 'done' &&
      <div style={{
        position: 'absolute', bottom: 110, left: 16, right: 16, zIndex: 25
      }}>
          {phase === 'idle' ?
        <button
          onClick={() => setPhase('running')}
          style={{
            width: '100%', height: 56, borderRadius: 18,
            border: 'none', background: AA.COLORS.primary, color: '#fff',
            fontSize: 16, fontWeight: 700, letterSpacing: -0.2, cursor: 'pointer',
            boxShadow: `0 10px 28px ${AA.COLORS.primary}55`,
            animation: 'popIn 0.25s ease'
          }}>
              Start
            </button> :

        <button
          onClick={() => setPhase('done')}
          style={{
            width: '100%', height: 56, borderRadius: 18,
            border: 'none', background: '#3f3f46', color: '#fff',
            fontSize: 16, fontWeight: 700, letterSpacing: -0.2, cursor: 'pointer',
            boxShadow: '0 10px 28px rgba(0,0,0,0.2)'
          }}>
              Stop
            </button>
        }
        </div>
      }

      <BreatheBanner score={score} contribute={true} />

      {phase === 'done' &&
      <div style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center',
        animation: 'fadeIn 0.3s ease'
      }}>
          <div style={{
          color: '#dc2626', marginBottom: 18,
          animation: 'heartbeat 1.4s ease-in-out infinite'
        }}>
            <AA.Icon.heart s={84} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#111', letterSpacing: -0.6, lineHeight: 1.15 }}>
            Thank you,<br />for your contribution!
          </div>
          <div style={{ fontSize: 14, color: '#52525b', marginTop: 12, maxWidth: 280, lineHeight: 1.5 }}>
            You covered 1.8 km and helped 312 vulnerable residents along your route.
          </div>
          <button
          onClick={() => {setPhase('idle');setSensor(null);}}
          style={{
            marginTop: 28, padding: '12px 22px', borderRadius: 999,
            border: 'none', background: AA.COLORS.primary, color: '#fff',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 8px 20px ${AA.COLORS.primary}55`
          }}>
            Done
          </button>
        </div>
      }
    </div>);

}

// ──────────────── LOCK SCREEN ────────────────
function LockScreen({ onUnlock }) {
  // Smoothly traverse DANGER_WALK with requestAnimationFrame so the marker
  // glides between waypoints instead of stepping.
  const path = AA.DANGER_WALK;
  const [markerPos, setMarkerPos] = useStateS(path[0].pos);

  useEffectS(() => {
    const path = AA.DANGER_WALK;
    const segmentMs = 1300;
    const tickMs = 40;
    const totalMs = (path.length - 1) * segmentMs;
    const startedAt = Date.now();
    const ease = (f) => f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    const id = setInterval(() => {
      const elapsed = Math.min(Date.now() - startedAt, totalMs);
      const t = elapsed / segmentMs;
      const i = Math.min(Math.floor(t), path.length - 2);
      const f = ease(t - i);
      const a = path[i].pos;
      const b = path[i + 1].pos;
      setMarkerPos([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      if (elapsed >= totalMs) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, []);

  const score = AA.scoreForPosition(markerPos, AA.HOTSPOTS);
  const theme = AA.scoreTheme(score);
  // Phase derived from the live score so the widget pulses, recolors, and
  // updates the marker treatment in sync with the smooth motion.
  const phase = score < 30 ? 'danger' : score < 65 ? 'transit' : 'safe';
  // Keep the widget's icon constant across danger levels — only color and
  // score change, so the layout never reflows.
  const IconC = AA.Icon.neutral;

  // Widget body: keep map at a generous height, fill the score column with
  // larger type so the percentage reads as the headline.
  const mapH = 148;
  const scoreW = 126;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'linear-gradient(180deg, #0c0a14 0%, #1a1530 55%, #2a1f48 100%)',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 0%, rgba(124,58,237,0.35) 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(220,38,38,0.18) 0%, transparent 60%)',
        opacity: phase === 'danger' ? 1 : 0.55,
        transition: 'opacity 1s ease'
      }} />

      {/* Time */}
      <div style={{
        position: 'absolute', top: 78, left: 0, right: 0,
        textAlign: 'center', color: '#fff',
        textShadow: '0 2px 12px rgba(0,0,0,0.4)'
      }}>
        <div style={{ fontSize: 18, fontWeight: 500, opacity: 0.95, letterSpacing: 0.3 }}>
          Wednesday, May 27
        </div>
        <div style={{ fontSize: 92, fontWeight: 200, letterSpacing: -3, lineHeight: 1, marginTop: -2 }}>
          14:18
        </div>
      </div>

      {/* AirAware widget */}
      <div style={{
        position: 'absolute', top: 290, left: 16, right: 16,
        background: phase === 'danger' ?
        'linear-gradient(180deg, rgba(40,12,12,0.78) 0%, rgba(70,16,16,0.7) 100%)' :
        'rgba(28,28,36,0.72)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        borderRadius: 24,
        padding: 14,
        border: phase === 'danger' ? '1px solid rgba(248,113,113,0.45)' : '1px solid rgba(255,255,255,0.10)',
        boxShadow: phase === 'danger' ?
        '0 20px 60px rgba(220,38,38,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)' :
        '0 20px 40px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
        color: '#fff',
        animation: phase === 'danger' ? 'heartbeat 1.2s ease-in-out infinite' : 'softPulse 3.6s ease-in-out infinite',
        transition: 'background 0.6s ease, border-color 0.6s ease'
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <LogoDot />
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>AirAware</div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 500 }}>now</div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.95, letterSpacing: -0.15, marginBottom: 10 }}>
          Currently monitoring your surroundings.
        </div>

        {/* Body: wider map + smaller score */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            flex: 1, height: mapH,
            borderRadius: 14, overflow: 'hidden',
            position: 'relative',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)'
          }}>
            <LeafletMap
              center={markerPos}
              zoom={16.5}
              hotspots={AA.HOTSPOTS}
              userPos={markerPos}
              pulseUser={phase === 'danger'}
              followUser={true}
              tileStyle="positron" />
            
            <div style={{
              position: 'absolute', inset: 0,
              boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28)',
              pointerEvents: 'none'
            }} />
          </div>

          <div style={{
            width: scoreW,
            backgroundColor: theme.bg,
            borderRadius: 14,
            padding: '10px 12px',
            color: '#fff',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            boxShadow: `0 6px 18px ${theme.bg}55`,
            transition: 'background-color 0.5s ease, box-shadow 0.5s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconC s={18} />
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', opacity: 0.95 }}>
                Breathe
              </div>
            </div>
            <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 0.95, letterSpacing: -2, marginTop: 2 }}>
              {score}<span style={{ fontSize: 22, opacity: 0.9, fontWeight: 700, letterSpacing: -0.5 }}>%</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.95, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {theme.label}
            </div>
          </div>
        </div>

        {/* Footer line */}
        <div style={{
          marginTop: 10, fontSize: 11, opacity: 0.7, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: phase === 'danger' ? '#f87171' : '#86efac', animation: 'pulse 1.4s infinite' }} />
          5. district · Margareten
        </div>
      </div>

      {/* dismiss */}
      <div style={{
        position: 'absolute', bottom: 56, left: 0, right: 0,
        textAlign: 'center'
      }}>
        <button onClick={onUnlock} style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.78)',
          fontSize: 12, fontWeight: 600, letterSpacing: 0.3, cursor: 'pointer',
          textTransform: 'uppercase'
        }}>↑ Swipe up to dismiss</button>
      </div>
    </div>);

}

Object.assign(window, { AppHeader, MapTab, ContributeTab, LockScreen, LogoDot });
// AirAware Vienna — main app composition + right-side info panel
const { useState: useStateA, useEffect: useEffectA } = React;

function Sidebar({ activeTask, onSimulate, lockMode, onExitLock }) {
  const tasks = {
    map: {
      n: 'Task 1',
      title: 'Finding a low-pollution route',
      role: 'Vulnerable resident · May, 68',
      body: 'May checks the Breathe-Score and enters her destination. She selects the Health-Priority option to see the Green Corridor, which guides her safely through the city.',
      step: 'Tap the search bar to enter "HTL Spengergasse".',
      actions: null,
    },
    alerts: {
      n: 'Task 2',
      title: 'Proactive alerts in the background',
      role: 'Vulnerable resident · May, 68',
      body: 'Even when the app is in the background, the system monitors air quality. Entering a hazardous area triggers a haptic vibration and a visual lock-screen alert, allowing users to react instantly without unlocking their phone.',
      step: lockMode ? 'Watch May’s location move into the red zone, the widget pulses to mimic haptic feedback.' : 'Trigger the simulation to see the lock-screen alert.',
      actions: lockMode ? (
        <button onClick={onExitLock} style={btnSecondary}>← Back to map</button>
      ) : (
        <button onClick={onSimulate} style={btnPrimary}>Simulate Danger Zone</button>
      ),
    },
    contribute: {
      n: 'Task 3',
      title: 'Data contribution by delivery drivers',
      role: 'Delivery driver · Tomas',
      body: 'Delivery drivers connect mobile sensors to improve the network. The Start button is only available once a sensor is connected. A green data-trail confirms the transmission, followed by a thank-you message upon completion.',
      step: 'Open the sensor dropdown, pick "Sensor kit 1", then tap Start.',
      actions: null,
    },
  };
  const t = tasks[activeTask];

  return (
    <div style={{
      width: 360,
      maxHeight: 'calc(100vh - 80px)',
      background: '#fff',
      borderRadius: 24,
      padding: '24px 24px 22px',
      boxShadow: '0 30px 80px rgba(20,16,46,0.10), 0 2px 8px rgba(20,16,46,0.04)',
      border: '1px solid #efeaf8',
      display: 'flex', flexDirection: 'column', gap: 18,
      fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: AA.COLORS.primary,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2"/>
            <path d="M12 11v6M12 8v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', letterSpacing: -0.2 }}>Walkthrough</div>
        <div style={{ flex: 1 }}/>
        <div style={{
          fontSize: 11, fontWeight: 700, color: AA.COLORS.primary,
          background: '#f3eefe', padding: '4px 8px', borderRadius: 999, letterSpacing: 0.3,
        }}>{t.n}</div>
      </div>

      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.4,
        }}>{t.role}</div>
        <div style={{ fontSize: 23, fontWeight: 800, color: '#111', letterSpacing: -0.7, marginTop: 4, lineHeight: 1.15 }}>
          {t.title}
        </div>
      </div>

      <div style={{ fontSize: 14, color: '#3f3f46', lineHeight: 1.55, letterSpacing: -0.1 }}>
        {t.body}
      </div>

      <div style={{
        padding: '12px 14px', borderRadius: 12, background: '#f9f7ff',
        border: '1px dashed #d8caff',
        display: 'flex', alignItems: 'start', gap: 10,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 999, background: AA.COLORS.primary,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
        }}>↻</div>
        <div style={{ fontSize: 13, color: '#52525b', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700, color: '#111' }}>Try it: </span>{t.step}
        </div>
      </div>

      {t.actions}

      {/* Task switcher (subtle) */}
      <div style={{
        marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #f4f4f5',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
          Jump to task
        </div>
        {[
          { id: 'map',        label: '1 · Low-pollution route' },
          { id: 'alerts',     label: '2 · Proactive alerts' },
          { id: 'contribute', label: '3 · Contribute data' },
        ].map(o => (
          <button key={o.id}
            onClick={() => window.__aaJump?.(o.id)}
            style={{
              textAlign: 'left',
              background: activeTask === o.id ? '#f3eefe' : 'transparent',
              color: activeTask === o.id ? AA.COLORS.primaryDeep : '#52525b',
              fontSize: 13, fontWeight: 600, letterSpacing: -0.1,
              padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

const btnPrimary = {
  width: '100%', padding: '12px 16px',
  background: AA.COLORS.primary, color: '#fff',
  border: 'none', borderRadius: 12,
  fontSize: 14, fontWeight: 700, letterSpacing: -0.2, cursor: 'pointer',
  boxShadow: `0 8px 20px ${AA.COLORS.primary}33`,
};
const btnSecondary = {
  width: '100%', padding: '12px 16px',
  background: '#f4f4f5', color: '#27272a',
  border: 'none', borderRadius: 12,
  fontSize: 14, fontWeight: 600, letterSpacing: -0.2, cursor: 'pointer',
};

// Toggle handle on the right edge when panel hidden
function PanelToggle({ open, onClick }) {
  return (
    <button onClick={onClick} aria-label="Toggle info panel"
      style={{
        position: 'fixed', top: 26, right: 24, zIndex: 200,
        width: 42, height: 42, borderRadius: 999,
        background: '#fff', border: '1px solid #efeaf8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: AA.COLORS.primary, cursor: 'pointer',
        boxShadow: '0 10px 30px rgba(20,16,46,0.12)',
      }}>
      {open ? <AA.Icon.close s={18}/> : <AA.Icon.info s={20}/>}
    </button>
  );
}

// ──────────────── APP ────────────────
function App() {
  const [tab, setTab] = useStateA('map');                 // 'map' | 'contribute'
  const [lockMode, setLockMode] = useStateA(false);
  const [panelOpen, setPanelOpen] = useStateA(true);

  // Map sub-state
  const [mapState, setMapState] = useStateA('idle');      // 'idle' | 'typing' | 'picker' | 'routing'
  const [route, setRoute] = useStateA(null);              // 'health' | 'fastest' | null
  const [searchValue, setSearchValue] = useStateA('');

  // Contribute sub-state
  const [phase, setPhase] = useStateA('idle');            // 'idle' | 'running' | 'done'
  const [sensor, setSensor] = useStateA(null);

  // Derived: which task is "active" for sidebar copy
  const activeTask =
    lockMode ? 'alerts'
    : tab === 'contribute' ? 'contribute'
    : 'map';

  // Expose jump
  useEffectA(() => {
    window.__aaJump = (id) => {
      if (id === 'map')        { setLockMode(false); setTab('map'); }
      if (id === 'alerts')     { /* show alerts copy in panel without forcing lock */ setLockMode(false); setTab('map'); setTimeout(() => {
        // bias the sidebar by reading activeTask through a sentinel
        window.__aaForceTask = 'alerts';
        // hack: re-render via dummy state
        setMapState(s => s);
      }, 0); }
      if (id === 'contribute') { setLockMode(false); setTab('contribute'); }
    };
  }, []);

  // Allow forcing 'alerts' task view
  const [forcedAlerts, setForcedAlerts] = useStateA(false);
  useEffectA(() => {
    const t = setInterval(() => {
      if (window.__aaForceTask === 'alerts' && !forcedAlerts) {
        setForcedAlerts(true);
        delete window.__aaForceTask;
      }
    }, 100);
    return () => clearInterval(t);
  }, [forcedAlerts]);

  // When user interacts with phone or switches tab, drop forced alerts
  useEffectA(() => { if (lockMode || tab === 'contribute' || mapState !== 'idle') setForcedAlerts(false); }, [lockMode, tab, mapState]);

  const sidebarTask = lockMode ? 'alerts' : (forcedAlerts ? 'alerts' : activeTask);

  return (
    <div data-screen-label="AirAware Prototype" style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 100% 70% at 50% 0%, #f0eafc 0%, #f7f5fb 40%, #fafafa 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px',
      fontFamily: '"Inter", -apple-system, system-ui, sans-serif',
      gap: 56,
    }}>
      {/* Brand mark top-left */}
      <div style={{
        position: 'fixed', top: 26, left: 28, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <LogoDot/>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1530', letterSpacing: -0.2 }}>AirAware</div>
        <span style={{ fontSize: 11, color: '#71717a', fontWeight: 500, padding: '3px 7px', background: '#fff', border: '1px solid #efeaf8', borderRadius: 999 }}>
          Vienna · Prototype
        </span>
      </div>

      {/* Phone */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <IOSDevice width={402} height={874} dark={true}>
          <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            {tab === 'map' && !lockMode && (
              <MapTab
                mapState={mapState}
                setMapState={setMapState}
                route={route}
                setRoute={setRoute}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
              />
            )}
            {tab === 'contribute' && !lockMode && (
              <ContributeTab
                phase={phase} setPhase={setPhase}
                sensor={sensor} setSensor={setSensor}
              />
            )}
            {!lockMode && <AppHeader tab={tab} onTabChange={setTab}/>}
            {lockMode && (
              <LockScreen onUnlock={() => setLockMode(false)}/>
            )}
          </div>
        </IOSDevice>
      </div>

      {/* Sidebar */}
      {panelOpen && (
        <div style={{ animation: 'slideRight 0.3s ease' }}>
          <Sidebar
            activeTask={sidebarTask}
            lockMode={lockMode}
            onSimulate={() => setLockMode(true)}
            onExitLock={() => setLockMode(false)}
          />
        </div>
      )}

      <PanelToggle open={panelOpen} onClick={() => setPanelOpen(o => !o)}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

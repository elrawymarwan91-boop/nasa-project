import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, BatteryCharging, Check, ChevronRight, CircleHelp,
  CloudSun, Droplets, Gauge, Leaf, LoaderCircle, LockKeyhole, Pause, Play, Radio,
  RotateCcw, Send, Shield, Sun, Thermometer, Wind, Wrench, X, Zap, Plus, Minus, LocateFixed, Navigation
} from "lucide-react";
import type Phaser from "phaser";
import type { BuildingId, CrewTask, GameState, PlayerAction } from "../shared/game";
import { CAMPAIGN_ID, SCIENCE_CARDS } from "../shared/game";
import type { OutpostScene } from "./game/OutpostScene";
import VehicleCockpit from "./VehicleCockpit";

type GameResponse = { gameId: string; state: GameState };
type Screen = "menu" | "briefing" | "game" | "debrief";
type ConsoleTab = "systems" | "crew" | "missions" | "events" | "science";
type CommandMode = "outpost" | "spacecraft" | "rover";

const API = "/api/v1";

class ApiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body &&
      body.error && typeof body.error === "object" && "message" in body.error
      ? String(body.error.message)
      : `Request failed (${response.status}).`;
    throw new ApiRequestError(response.status, message);
  }
  return body as T;
}

function percentage(value: number, capacity: number) {
  return Math.max(0, Math.min(100, Math.round(value / capacity * 100)));
}

function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [activeMode, setActiveMode] = useState<CommandMode>("outpost");
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [savedGame, setSavedGame] = useState(false);
  const [selectedId, setSelectedId] = useState<BuildingId>("habitat");
  const [tab, setTab] = useState<ConsoleTab>("systems");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scienceCards, setScienceCards] = useState<Array<(typeof SCIENCE_CARDS)[number]>>([...SCIENCE_CARDS]);
  const [crewSelection, setCrewSelection] = useState<Record<string, CrewTask>>({});
  const worldRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OutpostScene | null>(null);
  const engineRef = useRef<Phaser.Game | null>(null);
  const selectedBuilding = useMemo(
    () => game?.buildings.find((building) => building.id === selectedId) ?? game?.buildings[0],
    [game?.buildings, selectedId]
  );
  const unresolvedEvent = useMemo(() => game?.events.find((event) => !event.resolved) ?? null, [game?.events]);

  const restore = useCallback(async () => {
    try {
      const current = await request<GameResponse>(`${API}/games/current`);
      setGameId(current.gameId);
      setGame(current.state);
      setSavedGame(true);
    } catch (reason) {
      if (!(reason instanceof ApiRequestError && (reason.status === 401 || reason.status === 404))) {
        setError(reason instanceof Error ? reason.message : "Could not restore the guest campaign.");
      }
    }
  }, []);

  useEffect(() => {
    void restore();
    void request<{ cards: Array<(typeof SCIENCE_CARDS)[number]> }>(`${API}/data/science-cards`)
      .then(({ cards }) => setScienceCards(cards))
      .catch(() => setScienceCards([...SCIENCE_CARDS]));
  }, [restore]);

  useEffect(() => {
    const handleSelect = (event: Event) => {
      const detail = (event as CustomEvent<BuildingId>).detail;
      if (detail) setSelectedId(detail);
      setTab("systems");
    };
    window.addEventListener("outpost:select", handleSelect);
    return () => window.removeEventListener("outpost:select", handleSelect);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    if (screen !== "game" || !worldRef.current || !game) return;
    let cancelled = false;
    let engine: Phaser.Game | null = null;
    void Promise.all([import("phaser"), import("./game/OutpostScene")])
      .then(([phaserModule, { OutpostScene: PhaserScene }]) => {
        if (cancelled || !worldRef.current) return;
        const PhaserRuntime = phaserModule.default;
        const scene = new PhaserScene({
          buildings: game.buildings,
          rover: game.rover,
          selectedId,
          onSelect: (id) => window.dispatchEvent(new CustomEvent("outpost:select", { detail: id }))
        });
        sceneRef.current = scene;
        engine = new PhaserRuntime.Game({
          type: PhaserRuntime.WEBGL,
          parent: worldRef.current,
          backgroundColor: "#8c4c32",
          scale: { mode: PhaserRuntime.Scale.RESIZE, width: 1100, height: 610 },
          render: { antialias: true, pixelArt: false },
          scene: [scene]
        });
        engineRef.current = engine;
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The isometric world could not be loaded."));
    return () => {
      cancelled = true;
      sceneRef.current = null;
      engine?.destroy(true);
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [screen, activeMode]);

  useEffect(() => {
    if (!game || !sceneRef.current) return;
    sceneRef.current.updateState({
      buildings: game.buildings,
      rover: game.rover,
      selectedId,
      onSelect: (id) => window.dispatchEvent(new CustomEvent("outpost:select", { detail: id }))
    });
  }, [game, selectedId]);

  async function beginCampaign() {
    setBusy(true);
    setError("");
    try {
      const created = await request<GameResponse>(`${API}/games`, {
        method: "POST",
        body: JSON.stringify({ missionId: CAMPAIGN_ID })
      });
      setGameId(created.gameId);
      setGame(created.state);
      setActiveMode("outpost");
      setCrewSelection({});
      setShowReport(false);
      setShowTelemetry(false);
      setSavedGame(true);
      setScreen("briefing");
      setSelectedId("habitat");
      setTab("systems");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function continueCampaign() {
    setBusy(true);
    setError("");
    try {
      const current = await request<GameResponse>(`${API}/games/current`);
      setGameId(current.gameId);
      setGame(current.state);
      setCrewSelection(Object.fromEntries(current.state.crew.map((member) => [member.id, member.task])));
      setShowReport(false);
      setSavedGame(true);
      setScreen(current.state.phase === "briefing" ? "briefing" : current.state.status === "active" ? "game" : "debrief");
      setActiveMode("outpost");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function startMission() {
    if (!gameId || !game) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<GameResponse>(`${API}/games/${gameId}/start`, {
        method: "POST",
        body: JSON.stringify({ expectedStateVersion: game.stateVersion })
      });
      setGame(result.state);
      setScreen("game");
      setActiveMode("outpost");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the mission.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAction(action: PlayerAction) {
    if (!gameId) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<GameResponse>(`${API}/games/${gameId}/actions`, {
        method: "POST",
        body: JSON.stringify(action)
      });
      setGame(result.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action could not be queued.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelAction(actionId: string) {
    if (!gameId) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<GameResponse>(`${API}/games/${gameId}/actions/${actionId}`, { method: "DELETE" });
      setGame(result.state);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action could not be cancelled.");
    } finally {
      setBusy(false);
    }
  }

  async function advanceSol() {
    if (!gameId || !game) return;
    setBusy(true);
    setError("");
    try {
      const result = await request<GameResponse>(`${API}/games/${gameId}/advance`, {
        method: "POST",
        body: JSON.stringify({
          expectedStateVersion: game.stateVersion,
          idempotencyKey: crypto.randomUUID()
        })
      });
      setGame(result.state);
      setShowReport(true);
      if (result.state.events.some((event) => !event.resolved)) setTab("events");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Sol could not be advanced.");
    } finally {
      setBusy(false);
    }
  }

  const errorBanner = error ? (
    <div className="error-banner" role="alert">
      <AlertTriangle size={16} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={15} /></button>
    </div>
  ) : null;

  if (screen === "menu") {
    return (
      <main className="game-shell menu-screen">
        <div className="sky-field"><span /><i /><b /></div>
        <header className="brand-mark"><span className="brand-emblem"><Radio size={20} /></span><span>MISSION CONTROL <b>/</b> SOL 01</span></header>
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> HUMANITY'S NEXT HORIZON</p>
            <h1>OUTPOST<br /><em>COMMANDER</em></h1>
            <p className="hero-lede">Fifteen sols. Four lives. One chance to make Mars feel like home.</p>
            <div className="hero-actions">
              <button className="button-primary" onClick={() => void beginCampaign()} disabled={busy}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <Play size={16} fill="currentColor" />} Start new campaign <ChevronRight size={17} />
              </button>
              <button className="button-ghost" onClick={() => void continueCampaign()} disabled={!savedGame || busy}>
                <RotateCcw size={15} /> Continue campaign
              </button>
              <button className="button-quiet" onClick={() => setShowGuide(true)}><CircleHelp size={15} /> How to play</button>
              <button className="button-quiet" onClick={() => setShowSettings(true)}><Wrench size={14} /> Settings</button>
              <button className="button-quiet" onClick={() => setShowCredits(true)}><Radio size={14} /> Credits & data</button>
            </div>
            {errorBanner}
          </div>
          <div className="hero-art" aria-label="Illustration of the Mars outpost">
            <div className="planet"><span className="planet-crater crater-one" /><span className="planet-crater crater-two" /><span className="planet-crater crater-three" /></div>
            <div className="horizon-glow" />
            <div className="landing-site">
              <span className="dish" /><span className="habitat-dome" /><span className="mast" /><span className="lander" />
              <span className="site-shadow" />
            </div>
            <div className="hero-coordinate">4.5895°S&nbsp;&nbsp; 137.4417°E<br />GALE CRATER · MARS</div>
          </div>
        </section>
        <footer className="menu-footer">
          <span><span className="signal-bars">▂ ▄ ▆</span> DEEP SPACE LINK ESTABLISHED</span>
          <span>FICTIONAL SURVIVAL SIMULATION <i>·</i> ALL SYSTEMS NOMINAL</span>
        </footer>
        {showGuide && <HowToPlay onClose={() => setShowGuide(false)} />}
        {showSettings && <SettingsDialog reducedMotion={reducedMotion} onChange={setReducedMotion} onClose={() => setShowSettings(false)} />}
        {showCredits && <CreditsDialog onClose={() => setShowCredits(false)} />}
      </main>
    );
  }

  if (screen === "briefing" && game) {
    return (
      <main className="game-shell briefing-screen">
        <header className="screen-topline"><button className="icon-button" onClick={() => setScreen("menu")} aria-label="Back"><ArrowLeft size={17} /></button><span>MISSION DOSSIER <b>·</b> MARS / GALE CRATER</span><span className="secure-label"><LockKeyhole size={13} /> GUEST SESSION SECURE</span></header>
        <section className="briefing-layout">
          <div className="briefing-title"><span className="eyebrow">CAMPAIGN 01 — FIRST LIGHT</span><h1>Gale Crater<br /><em>Outpost</em></h1><p>Establish a foothold in a world that does not forgive mistakes.</p><div className="campaign-stamp">15 <small>MARTIAN<br />SOLS</small></div></div>
          <div className="briefing-content">
            <div className="briefing-stat-row">
              <BriefStat label="LOCATION" value="Gale Crater" icon={<Activity size={16} />} />
              <BriefStat label="DURATION" value="15 Sols" icon={<Gauge size={16} />} />
              <BriefStat label="CREW" value="4 specialists" icon={<Shield size={16} />} />
            </div>
            <div className="briefing-panels">
              <article className="briefing-card">
                <span className="eyebrow">PRIMARY OBJECTIVES</span>
                <ul><li><Check size={14} /> Keep the four-person crew alive through Sol 15.</li><li><Check size={14} /> Return a rover survey with useful science.</li><li><Check size={14} /> Maintain breathable pressure and stable supplies.</li></ul>
              </article>
              <article className="briefing-card crew-brief">
                <span className="eyebrow">FLIGHT CREW</span>
                {game.crew.map((member) => <div key={member.id} className="crew-line"><span className="crew-avatar">{member.name.split(" ").map((part) => part[0]).join("")}</span><span><b>{member.name}</b><small>{member.role}</small></span><i>100%</i></div>)}
              </article>
            </div>
            <div className="briefing-supplies">
              <span className="eyebrow">INITIAL STORES</span>
              <div><b>{game.resources.oxygenKg.toFixed(0)} <small>kg</small></b><span>OXYGEN</span></div>
              <div><b>{game.resources.waterLiters.toFixed(0)} <small>L</small></b><span>WATER</span></div>
              <div><b>{game.resources.foodKg.toFixed(0)} <small>kg</small></b><span>FOOD · DRY SOLIDS</span></div>
              <div><b>{game.resources.batteryKwh.toFixed(0)} <small>kWh</small></b><span>ENERGY</span></div>
            </div>
            <div className="briefing-bottom"><p><AlertTriangle size={15} /> The model uses published NASA reference values plus clearly labelled scenario assumptions. No live Gale weather feed is connected.</p><button className="button-primary" onClick={() => void startMission()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} fill="currentColor" />} Enter the outpost <ChevronRight size={17} /></button></div>
          </div>
        </section>
        {errorBanner}
      </main>
    );
  }

  if (screen === "debrief" && game) {
    return <Debrief game={game} onRestart={() => void beginCampaign()} onReturn={() => setScreen("game")} busy={busy} />;
  }

  if (!game) {
    return <main className="game-shell loading-screen"><LoaderCircle className="spin" size={24} /><span>RESTORING OUTPOST LINK</span>{errorBanner}</main>;
  }

  const resources = game.resources;
  const resourceItems = [
    { key: "oxygenKg", label: "O₂ reserve", value: resources.oxygenKg, capacity: resources.oxygenCapacityKg, unit: "kg", tone: "cyan", icon: <Wind size={15} /> },
    { key: "waterLiters", label: "Water", value: resources.waterLiters, capacity: resources.waterCapacityLiters, unit: "L", tone: "blue", icon: <Droplets size={15} /> },
    { key: "foodKg", label: "Food solids", value: resources.foodKg, capacity: resources.foodCapacityKg, unit: "kg dry", tone: "green", icon: <Leaf size={15} /> },
    { key: "batteryKwh", label: "Stored energy", value: resources.batteryKwh, capacity: resources.batteryCapacityKwh, unit: "kWh", tone: "amber", icon: <BatteryCharging size={15} /> }
  ];

  return (
    <main className="game-shell command-screen">
      <header className="command-header">
        <div className="command-brand"><button className="mini-emblem" onClick={() => setShowGuide(true)} aria-label="How to play"><Radio size={18} /></button><div><span className="eyebrow">GALE CRATER · MARS</span><h1>OUTPOST <em>COMMANDER</em></h1></div></div>
        <div className="sol-display"><span className="live-dot" /><span className="sol-number">SOL {String(Math.min(game.sol, game.totalSols)).padStart(2, "0")}</span><span className="sol-slash">/</span><span className="sol-total">{game.totalSols}</span><span className="sol-progress"><i style={{ width: `${Math.min(100, (game.history.length / game.totalSols) * 100)}%` }} /></span></div>
        <nav className="mode-navigation" aria-label="Mission workspace">
          <button className={activeMode === "outpost" ? "active" : ""} onClick={() => setActiveMode("outpost")}><Activity size={14} /> OUTPOST</button>
          <button className={activeMode === "spacecraft" ? "active" : ""} onClick={() => setActiveMode("spacecraft")}><Radio size={14} /> SPACECRAFT</button>
          <button className={activeMode === "rover" ? "active" : ""} onClick={() => setActiveMode("rover")}><Navigation size={14} /> ROVER</button>
        </nav>
        <div className="command-controls"><span className="link-status"><span /> LINK STABLE</span><button className="icon-button" onClick={() => setShowSettings(true)} aria-label="Pause and settings"><Pause size={15} /></button></div>
      </header>
      <section className="resource-strip">
        {resourceItems.map((item) => {
          const value = percentage(item.value, item.capacity);
          return <div key={item.key} className={`resource-chip ${item.tone}`}>
            <span className="resource-icon">{item.icon}</span><div className="resource-data"><span className="resource-label">{item.label}</span><b>{item.value.toFixed(item.key === "oxygenKg" ? 1 : 0)} <small>{item.unit}</small></b></div><div className="resource-gauge"><i style={{ height: `${value}%` }} /></div><span className="resource-percent">{value}%</span>
          </div>;
        })}
        <div className="resource-chip power-chip"><span className="resource-icon"><Zap size={15} /></span><div className="resource-data"><span className="resource-label">Power balance</span><b>{resources.powerBalanceKw >= 0 ? "+" : ""}{resources.powerBalanceKw.toFixed(1)} <small>kW</small></b></div><span className={`balance-tag ${resources.powerBalanceKw >= 0 ? "positive" : "negative"}`}>{resources.powerBalanceKw >= 0 ? "SURPLUS" : "DEFICIT"}</span></div>
        <div className="resource-chip pressure-chip"><span className="resource-icon"><Activity size={15} /></span><div className="resource-data"><span className="resource-label">Cabin pressure</span><b>{resources.cabinPressureKpa.toFixed(1)} <small>kPa</small></b></div></div>
      </section>
      <section className={`environment-strip ${showTelemetry ? "expanded" : "compact"}`} aria-label="Mars environment model">
        <div className="environment-heading"><span>MARS ENVIRONMENT MODEL</span><div><b>{game.environment.dustStorm ? "DUST STORM SCENARIO" : "CLEAR-SKY SCENARIO"}</b><button className="telemetry-toggle" onClick={() => setShowTelemetry((value) => !value)} aria-expanded={showTelemetry}>{showTelemetry ? "Hide details" : "Show details"} {showTelemetry ? <Minus size={12} /> : <Plus size={12} />}</button></div></div>
        {showTelemetry && <div className="environment-readout"><span><small>GRAVITY</small><b>{game.environment.gravityMps2.toFixed(2)} <i>m/s²</i></b></span><span><small>SOL LENGTH</small><b>{game.environment.solLengthHours.toFixed(2)} <i>h</i></b></span><span><small>IRRADIANCE · REFERENCE</small><b>{game.environment.solarIrradianceTopWm2.toFixed(0)} <i>W/m²</i></b></span><span><small>SURFACE MODEL</small><b>{game.environment.solarIrradianceSurfaceWm2.toFixed(0)} <i>W/m²</i></b></span><span><small>PV ENERGY / SOL</small><b>{game.environment.solarEnergyKwh.toFixed(1)} <i>kWh</i></b></span><span><small>LOAD / SOL</small><b>{game.environment.energyDemandKwh.toFixed(1)} <i>kWh</i></b></span><span><small>DUST OPTICAL DEPTH</small><b>τ {game.environment.dustOpticalDepth.toFixed(1)}</b></span></div>}
        <p>NASA planetary reference + simplified scenario model · Not a live Gale weather feed · Radiation is an ordinal 0–100 game index, not dose</p>
      </section>
      {activeMode !== "outpost" ? <VehicleCockpit
        key={activeMode}
        vehicle={activeMode}
        game={game}
        busy={busy}
        onSelectVehicle={setActiveMode}
        onQueueRoverMission={(missionId) => void submitAction({ type: "send-rover", missionId })}
        onAdvanceSol={() => void advanceSol()}
      /> : <>
      <section className="quick-start-strip" aria-label="Getting started">
        <div className="quick-start-icon"><Play size={15} fill="currentColor" /></div>
        <div className="quick-start-copy"><b>YOUR FIRST SOL</b><span>1. Select a facility&nbsp; · &nbsp;2. Assign crew&nbsp; · &nbsp;3. Queue a rover survey&nbsp; · &nbsp;4. Advance Sol</span></div>
        <div className="quick-start-actions"><button className="quick-action" onClick={() => setTab("crew")}>CREW</button><button className="quick-action" onClick={() => setTab("missions")}>ROVER OPS</button><button className="quick-start-help" onClick={() => setShowGuide(true)}>HOW TO PLAY <ChevronRight size={14} /></button></div>
      </section>
      {errorBanner}
      <section className="command-layout">
        <aside className="side-column left-column">
          <PanelHeading label="OUTPOST STATUS" icon={<Gauge size={15} />} />
          <div className="stability-card">
            <div className="stability-heading"><span className="status-pip" /><b>{resources.oxygenKg > 80 && resources.waterLiters > 250 ? "SYSTEMS NOMINAL" : "RESOURCES LOW"}</b><small>SOL {String(Math.min(game.sol, game.totalSols)).padStart(2, "0")}</small></div>
            <div className="stability-detail"><span>Thermal control</span><b><Thermometer size={13} /> {resources.temperatureC.toFixed(1)}°C</b></div>
            <div className="stability-detail"><span>CO₂ scrubber</span><b><CloudSun size={13} /> {resources.carbonDioxideKg.toFixed(1)} kg</b></div>
            <div className="stability-detail"><span>Radiation risk index</span><b className={resources.radiationRisk > 55 ? "text-warning" : ""}><Shield size={13} /> {Math.round(resources.radiationRisk)} / 100</b></div>
          </div>
          <PanelHeading label="MISSION OBJECTIVES" icon={<Check size={15} />} />
          <div className="objective-list">
            <Objective done={game.objectives.survive} title="Survive 15 sols" note={`Sol ${Math.min(game.history.length, 15)} of 15`} />
            <Objective done={game.objectives.rover} title="Return a rover survey" note="Explore a nearby landmark" />
            <Objective done={game.objectives.science} title="Science threshold" note={`${Math.floor(resources.sciencePoints)} / 20 research`} />
          </div>
          <PanelHeading label="FACILITIES · SELECT ONE" icon={<LocateFixed size={15} />} />
          <div className="facility-list">
            {game.buildings.map((building) => <button key={building.id} className={`facility-item ${selectedId === building.id ? "selected" : ""}`} onClick={() => { setSelectedId(building.id); setTab("systems"); }} aria-pressed={selectedId === building.id}>
              <span className={`facility-state ${building.online ? "online" : "offline"}`} />
              <span className="facility-name">{building.name}<small>{building.subtitle}</small></span>
              <span className="facility-meta">{building.online ? "ONLINE" : "STANDBY"}<small>LVL {building.level}</small></span>
            </button>)}
          </div>
          <PanelHeading label="CREW CONDITION" icon={<Shield size={15} />} />
          <div className="crew-mini-list">{game.crew.map((member) => <div key={member.id} className="crew-mini"><span className="crew-avatar small">{member.name.split(" ").map((part) => part[0]).join("")}</span><span><b>{member.name.split(" ")[0]}</b><small>{member.role}</small></span><div className="crew-health"><i style={{ width: `${member.condition}%` }} /></div><strong>{Math.round(member.condition)}%</strong></div>)}</div>
        </aside>
        <section className="world-column">
          <div className="world-toolbar"><div><span className="world-live"><i /> COLONY SIMULATION</span><span className="world-location">CLICK A BUILDING TO INSPECT · GALE-INSPIRED MAP</span></div><div className="world-tools"><span className="world-help">RIGHT / MIDDLE RIGHT / MIDDLE DRAG: PAN <b>·</b> WHEEL: ZOOM</span><div className="world-zoom"><button className="icon-button" onClick={() => sceneRef.current?.zoomBy(-0.12)} aria-label="Zoom out"><Minus size={13} /></button><button className="icon-button" onClick={() => sceneRef.current?.resetCamera()} aria-label="Reset camera"><LocateFixed size={13} /></button><button className="icon-button" onClick={() => sceneRef.current?.zoomBy(0.12)} aria-label="Zoom in"><Plus size={13} /></button></div></div></div>
          <div className="world-stage"><div ref={worldRef} className="phaser-host" /><div className="map-coordinates">Gale-inspired fictional map <span>·</span> not to scale</div></div>
          <div className="world-footer">
            <div className="world-legend"><span><i className="legend-online" /> ONLINE</span><span><i className="legend-offline" /> STANDBY</span><span><i className="legend-crew" /> CREW</span></div>
            <div className="world-actions"><button className="button-ghost" onClick={() => setTab("missions")}><Send size={14} /> ROVER OPS</button><button className="button-primary advance-button" onClick={() => void advanceSol()} disabled={busy || game.status !== "active"}>{busy ? <LoaderCircle className="spin" size={15} /> : <ChevronRight size={16} />} ADVANCE SOL</button></div>
          </div>
          <div className="action-queue">
            <div className="queue-heading"><span>PLANNING QUEUE</span><b>{game.pendingActions.length} ACTION{game.pendingActions.length === 1 ? "" : "S"}</b></div>
            {game.pendingActions.length === 0 ? <p>No pending orders. Select a building, crew task, or rover route.</p> : game.pendingActions.map((action) => {
              const label = action.type === "toggle-building" ? `${action.buildingId} · ${action.online ? "online" : "standby"}` :
                action.type === "upgrade-building" ? `Upgrade ${action.buildingId}` :
                  action.type === "assign-crew" ? `Assign ${action.crewId} · ${action.task}` :
                    action.type === "send-rover" ? `Launch ${action.missionId} survey` : "Resolve event";
              return <div key={action.id} className="queued-order"><span><Check size={13} /> {label}</span><button onClick={() => void cancelAction(action.id)} disabled={busy} aria-label={`Cancel ${label}`}><X size={13} /></button></div>;
            })}
          </div>
        </section>
        <aside className="side-column right-column">
          <div className="operator-title"><div><span className="eyebrow">COMMAND DECK</span><h2>Operator <em>console</em></h2></div><Wrench size={17} /></div>
          <nav className="console-tabs" aria-label="Command console">
            {(["systems", "crew", "missions", "events", "science"] as ConsoleTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}{item === "events" && unresolvedEvent && <i className="tab-alert" />}</button>)}
          </nav>
          <div className="console-content">
            {tab === "systems" && selectedBuilding && <BuildingConsole building={selectedBuilding} busy={busy} pendingToggle={game.pendingActions.some((action) => action.type === "toggle-building" && action.buildingId === selectedBuilding.id)} pendingUpgrade={game.pendingActions.some((action) => action.type === "upgrade-building" && action.buildingId === selectedBuilding.id)} onToggle={() => void submitAction({ type: "toggle-building", buildingId: selectedBuilding.id, online: !selectedBuilding.online })} onUpgrade={() => void submitAction({ type: "upgrade-building", buildingId: selectedBuilding.id })} />}
            {tab === "crew" && <div className="crew-console"><p className="console-intro">Assign each specialist before advancing. Crew tasks improve system output or research.</p>{game.crew.map((member) => <label key={member.id} className="task-card"><span className="crew-avatar small">{member.name.slice(0, 1)}</span><span className="task-person"><b>{member.name}</b><small>{member.role}</small></span><select value={crewSelection[member.id] ?? member.task} disabled={busy} onChange={(event) => { const task = event.target.value as CrewTask; setCrewSelection((current) => ({ ...current, [member.id]: task })); void submitAction({ type: "assign-crew", crewId: member.id, task }); }}><option value="maintenance">Maintenance</option><option value="biology">Biology</option><option value="research">Research</option><option value="rover">Rover ops</option></select></label>)}</div>}
            {tab === "missions" && <div className="mission-console"><p className="console-intro">Rover sorties take two Sols. Launch consumes 24 kWh and 8 kg of provisions.</p>{game.rover.map((mission) => <article key={mission.id} className={`mission-card ${mission.status}`}><div className="mission-card-top"><b>{mission.title}</b><span>{mission.status === "enroute" ? `${mission.solsRemaining} SOL LEFT` : mission.status.toUpperCase()}</span></div><small>{mission.destination} · +{mission.reward} science</small>{mission.status === "available" && <button className="button-small" disabled={busy || game.pendingActions.some((item) => item.type === "send-rover")} onClick={() => void submitAction({ type: "send-rover", missionId: mission.id })}><Send size={12} /> QUEUE LAUNCH</button>}</article>)}</div>}
            {tab === "events" && <div className="event-console">{unresolvedEvent ? <article className={`event-card ${unresolvedEvent.severity}`}><div className="event-kicker"><AlertTriangle size={14} /> {unresolvedEvent.severity.toUpperCase()} PRIORITY</div><h3>{unresolvedEvent.title}</h3><p>{unresolvedEvent.description}</p>{unresolvedEvent.choices.map((choice) => {
            const queued = game.pendingActions.some((action) => action.type === "resolve-event" && action.eventId === unresolvedEvent.id);
            return <button key={choice.id} className="event-choice" disabled={busy || queued} onClick={() => void submitAction({ type: "resolve-event", eventId: unresolvedEvent.id, choiceId: choice.id })}><span><b>{queued ? "RESPONSE QUEUED" : choice.label}</b><small>{choice.detail}</small></span><ChevronRight size={15} /></button>;
          })}</article> : <div className="empty-console"><Check size={20} /><b>No active incidents</b><p>Environmental events appear here when the next Sol begins.</p></div>}{game.events.slice(-3).reverse().filter((event) => event.resolved).map((event) => <div className="resolved-event" key={event.id}><Check size={13} /> Resolved · {event.title}</div>)}</div>}
            {tab === "science" && <div className="science-console"><div className="science-score"><span>RESEARCH BANK</span><b>{Math.floor(resources.sciencePoints)} <small>PTS</small></b><i><span style={{ width: `${Math.min(100, resources.sciencePoints / 20 * 100)}%` }} /></i></div>{scienceCards.map((card) => <article className="science-card" key={card.id}><span>{card.classification}</span><b>{card.title}</b><p>{card.text}</p><a href={card.url} target="_blank" rel="noreferrer">SOURCE: {card.source} ↗</a></article>)}</div>}
          </div>
        </aside>
      </section>
      <footer className="command-footer"><span>OUTPOST NETWORK <b>·</b> GUEST CAMPAIGN AUTOSAVE ACTIVE</span><span><span className="footer-led" /> MODEL ONLINE <b>·</b> NASA REFERENCES + GAME ASSUMPTIONS</span></footer>
      </>}
      {showReport && game.lastReport && <TurnReportModal report={game.lastReport} resources={game.resources} onClose={() => { setShowReport(false); if (game.status !== "active") setScreen("debrief"); }} />}
      {showGuide && <HowToPlay onClose={() => setShowGuide(false)} />}
      {showSettings && <SettingsDialog reducedMotion={reducedMotion} onChange={setReducedMotion} onClose={() => setShowSettings(false)} />}
      {showCredits && <CreditsDialog onClose={() => setShowCredits(false)} />}
    </main>
  );
}

function PanelHeading({ label, icon }: { label: string; icon: React.ReactNode }) {
  return <div className="section-heading"><span>{label}</span><i>{icon}</i></div>;
}

function Objective({ done, title, note }: { done: boolean; title: string; note: string }) {
  return <div className={`objective ${done ? "done" : ""}`}><span className="objective-check">{done ? <Check size={11} /> : <span />}</span><div><b>{title}</b><small>{note}</small></div><ChevronRight size={13} /></div>;
}

function BriefStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="brief-stat"><i>{icon}</i><span>{label}</span><b>{value}</b></div>;
}

function BuildingConsole({ building, busy, pendingToggle, pendingUpgrade, onToggle, onUpgrade }: {
  building: GameState["buildings"][number]; busy: boolean; pendingToggle: boolean; pendingUpgrade: boolean; onToggle: () => void; onUpgrade: () => void;
}) {
  return <div className="building-console">
    <div className="building-ident"><span className={`building-glyph glyph-${building.id}`}><BuildingGlyph id={building.id} /></span><div><span className={`online-label ${building.online ? "on" : "off"}`}><i /> {building.online ? "ONLINE" : "STANDBY"}</span><h3>{building.name}</h3><small>{building.subtitle}</small></div></div>
    <p className="building-description">{building.description}</p>
    <div className="building-stats"><div><span>CONDITION</span><b>{Math.round(building.condition)}%</b><i><em style={{ width: `${building.condition}%` }} /></i></div><div><span>UPGRADE</span><b>LVL {building.level} <small>/ 3</small></b><i><em style={{ width: `${building.level / 3 * 100}%` }} /></i></div></div>
    <div className="building-status-note"><Sun size={14} /><span>{building.id === "solar" ? "Output varies with weather and array condition." : building.id === "life-support" ? "Oxygen production and CO₂ scrubbing operate independently." : "Operations take effect when the next Sol is advanced."}</span></div>
    <div className="console-button-row"><button className="button-ghost" disabled={busy || pendingToggle} onClick={onToggle}>{pendingToggle ? `Queued: ${building.online ? "standby" : "online"}` : building.online ? "Set standby" : "Bring online"}</button><button className="button-small" disabled={busy || pendingUpgrade || building.level >= 3} onClick={onUpgrade}><Wrench size={12} /> {pendingUpgrade ? "UPGRADE QUEUED" : "UPGRADE · 90 L / 45 kWh / 4 SCI"}</button></div>
    {(pendingToggle || pendingUpgrade) && <p className="queued-explainer">Order queued. It will be applied when you advance this Sol.</p>}
  </div>;
}

function BuildingGlyph({ id }: { id: BuildingId }) {
  const labels: Record<BuildingId, React.ReactNode> = {
    habitat: <span className="glyph-dome" />,
    solar: <Sun size={22} />,
    battery: <BatteryCharging size={21} />,
    "life-support": <Wind size={21} />,
    "water-recovery": <Droplets size={21} />,
    greenhouse: <Leaf size={21} />,
    shelter: <Shield size={21} />,
    garage: <Radio size={21} />
  };
  return labels[id];
}

function TurnReportModal({ report, resources, onClose }: {
  report: GameState["lastReport"] extends infer R ? Exclude<R, null> : never;
  resources: GameState["resources"];
  onClose: () => void;
}) {
  const labels: Record<string, string> = { oxygenKg: "Oxygen", carbonDioxideKg: "CO₂", waterLiters: "Water", foodKg: "Food (dry solids)", batteryKwh: "Stored energy", sciencePoints: "Science", radiationRisk: "Radiation risk", temperatureC: "Temperature" };
  return <div className="modal-backdrop" role="presentation"><section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="turn-report-heading"><div className="modal-head"><span className="eyebrow">SOL {String(report.sol).padStart(2, "0")} · DAILY OPERATIONS REPORT</span><button className="icon-button" onClick={onClose} aria-label="Close report"><X size={17} /></button></div><h2 id="turn-report-heading">Sol complete<em>.</em></h2><p className="report-summary">{report.summary}</p><div className="report-content-grid"><div><h3>RESOURCE DELTAS</h3>{Object.entries(report.changes).filter(([key]) => key in labels).map(([key, delta]) => <div className="delta-row" key={key}><span>{labels[key]}</span><b className={delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : ""}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}</b></div>)}</div><div><h3>SYSTEM CHECK</h3><div className="report-current"><span>O₂ reserve</span><b>{resources.oxygenKg.toFixed(1)} kg</b></div><div className="report-current"><span>Water</span><b>{Math.round(resources.waterLiters)} L</b></div><div className="report-current"><span>Food</span><b>{Math.round(resources.foodKg)} kg</b></div><div className="report-current"><span>Science</span><b>{Math.floor(resources.sciencePoints)} pts</b></div></div></div>{report.completedActivities.length > 0 && <div className="report-activities"><h3>COMPLETED ACTIVITIES</h3>{report.completedActivities.map((activity) => <p key={activity}><Check size={13} /> {activity}</p>)}</div>}{report.eventTitle && <div className="report-alert"><AlertTriangle size={15} /> INCIDENT LOGGED: {report.eventTitle} — review the Events tab.</div>}<button className="button-primary report-continue" onClick={onClose}>RETURN TO COMMAND <ChevronRight size={16} /></button></section></div>;
}

function Debrief({ game, onRestart, onReturn, busy }: { game: GameState; onRestart: () => void; onReturn: () => void; busy: boolean }) {
  const success = game.status === "won";
  return <main className={`game-shell debrief-screen ${success ? "success" : "failure"}`}><div className="debrief-card"><span className="eyebrow">{success ? "MISSION COMPLETE · SOL 15" : "MISSION TERMINATED · OUTPOST LOST"}</span><div className="debrief-seal">{success ? <Check size={30} /> : <AlertTriangle size={29} />}</div><h1>{success ? <>OUTPOST<br /><em>ENDURES</em></> : <>MISSION<br /><em>LOST</em></>}</h1><p>{game.lastReport?.summary ?? "Mission assessment complete."}</p><div className="debrief-stats"><div><span>SOLS COMPLETED</span><b>{game.history.length} / {game.totalSols}</b></div><div><span>SCIENCE BANKED</span><b>{Math.floor(game.resources.sciencePoints)} <small>PTS</small></b></div><div><span>CREW CONDITION</span><b>{Math.round(game.crew.reduce((sum, member) => sum + member.condition, 0) / game.crew.length)}%</b></div><div><span>ROVER SURVEY</span><b>{game.objectives.rover ? "RETURNED" : "NOT COMPLETE"}</b></div></div><div className="debrief-objectives">{Object.entries(game.objectives).map(([key, done]) => <span key={key} className={done ? "done" : ""}><i>{done ? <Check size={11} /> : <X size={11} />}</i>{key.toUpperCase()}</span>)}</div><div className="hero-actions"><button className="button-primary" disabled={busy} onClick={onRestart}><RotateCcw size={15} /> New campaign</button><button className="button-ghost" onClick={onReturn}><ArrowLeft size={15} /> Return to base</button></div></div></main>;
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-heading"><div className="modal-head"><span className="eyebrow">COMMANDER'S FIELD GUIDE</span><button className="icon-button" onClick={onClose} aria-label="Close guide"><X size={17} /></button></div><h2 id="help-heading">How to play</h2><p>One turn is one Martian Sol. You plan operations across the outpost and vehicles, then the backend resolves the campaign when you advance time.</p><div className="play-steps">
    <article><i>01</i><span><b>Command the outpost</b><small>Select a facility from the map or Facilities list. Inspect its condition and queue operational changes in the Systems panel.</small></span></article>
    <article><i>02</i><span><b>Inspect the spacecraft</b><small>Open SPACECRAFT in the top navigation. Flight Deck, Navigation, Life Support, Electrical and Communications display the campaign's shared systems telemetry.</small></span></article>
    <article><i>03</i><span><b>Prepare the crew</b><small>Return to OUTPOST and assign Maintenance, Biology, Research or Rover Ops. Assignments take effect when the Sol advances.</small></span></article>
    <article><i>04</i><span><b>Deploy the Mars rover</b><small>Open ROVER, choose a survey destination and queue the sortie. The Rover Garage must be online; the current rules require 24 kWh and 8 kg of provisions. The trip takes two Sols.</small></span></article>
    <article><i>05</i><span><b>Advance the Sol</b><small>Use ADVANCE SOL from any workspace. The server resolves pending orders and returns a Sol Report. Review changes and respond to incidents.</small></span></article>
  </div><div className="help-note"><AlertTriangle size={15} /> The spacecraft cockpit is a mission-systems interface, not an orbital flight simulator yet. The rover sorties are resolved by the turn-based backend; continuous driving physics is not implemented. NASA reference values are separated from scenario assumptions.</div><button className="button-primary" onClick={onClose}>RETURN TO COMMAND <Check size={15} /></button></section></div>;
}

function CreditsDialog({ onClose }: { onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation"><section className="help-modal credits-modal" role="dialog" aria-modal="true" aria-labelledby="credits-heading"><div className="modal-head"><span className="eyebrow">SCIENTIFIC ATTRIBUTION</span><button className="icon-button" onClick={onClose} aria-label="Close credits"><X size={17} /></button></div><h2 id="credits-heading">Credits & data</h2><p>Published reference values are separated from scenario settings. No live NASA observation feed is connected in this build.</p><div className="credits-list"><a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html" target="_blank" rel="noreferrer"><b>NASA / NSSDC — Mars Fact Sheet</b><small>Mean surface gravity, solar irradiance reference, and Sol length.</small></a><a href="https://ntrs.nasa.gov/citations/20210024855" target="_blank" rel="noreferrer"><b>NASA — Life Support BVAD, Rev. 2 (2022)</b><small>Nominal crew oxygen, carbon dioxide, food solids, potable water, and crop reference values.</small></a><a href="https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf" target="_blank" rel="noreferrer"><b>NASA BVAD — full technical report</b><small>Tables 3-31 and 4-90 are used as model references.</small></a><a href="https://www.jpl.nasa.gov/images/pia16479-daily-cycles-of-radiation-and-pressure-at-gale-crater/" target="_blank" rel="noreferrer"><b>NASA JPL — Radiation and pressure at Gale Crater</b><small>Scientific context only; not used as an absolute radiation dose input.</small></a><a href="https://trek.nasa.gov/mars/" target="_blank" rel="noreferrer"><b>NASA Mars Trek</b><small>Reference for future terrain and elevation work; current map is fictional and not to scale.</small></a></div><div className="help-note"><AlertTriangle size={15} /> Solar-array size, cell efficiency, equivalent sun hours, habitat volume, thermal properties, and several equipment ratings are explicit game assumptions, not NASA hardware specifications.</div><button className="button-primary" onClick={onClose}>CLOSE <Check size={15} /></button></section></div>;
}

function SettingsDialog({ reducedMotion, onChange, onClose }: {
  reducedMotion: boolean;
  onChange: (value: boolean) => void;
  onClose: () => void;
}) {
  return <div className="modal-backdrop" role="presentation"><section className="help-modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading"><div className="modal-head"><span className="eyebrow">PREFERENCES</span><button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={17} /></button></div><h2 id="settings-heading">Settings</h2><p>Adjust interface motion. Campaign progress is saved independently to your guest session.</p><label className="setting-line"><span><b>Reduce motion</b><small>Disable interface transitions and ambient animation.</small></span><input type="checkbox" checked={reducedMotion} onChange={(event) => onChange(event.target.checked)} /></label><div className="help-note"><LockKeyhole size={15} /> Session saves use a secure HttpOnly guest cookie. No account is required.</div><button className="button-primary" onClick={onClose}>DONE <Check size={15} /></button></section></div>;
}

export default App;

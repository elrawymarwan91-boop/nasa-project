import { type CSSProperties, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowLeft, BatteryCharging, Check, ChevronRight, Compass,
  Droplets, FlaskConical, Gauge, Map, Navigation, Orbit, Power,
  Radio, RadioTower, Route, Satellite, ScanLine, Shield, Thermometer, Wind, Zap
} from "lucide-react";
import type { GameState, RoverMission } from "../shared/game";

type VehicleKind = "spacecraft" | "rover";
type VehicleModule = "flight" | "navigation" | "life-support" | "power" | "communications" | "driving" | "terrain" | "science" | "vehicle" | "log";

type Props = {
  vehicle: VehicleKind;
  game: GameState;
  busy: boolean;
  onSelectVehicle: (vehicle: "outpost" | VehicleKind) => void;
  onQueueRoverMission: (missionId: string) => void;
  onAdvanceSol: () => void;
};

const SPACECRAFT_MODULES: Array<{ id: VehicleModule; label: string; icon: typeof Orbit }> = [
  { id: "flight", label: "Flight deck", icon: Orbit },
  { id: "navigation", label: "Navigation", icon: Compass },
  { id: "life-support", label: "Life support", icon: Wind },
  { id: "power", label: "Electrical", icon: Zap },
  { id: "communications", label: "Communications", icon: RadioTower }
];
const ROVER_MODULES: Array<{ id: VehicleModule; label: string; icon: typeof Orbit }> = [
  { id: "driving", label: "Driving", icon: Gauge },
  { id: "terrain", label: "Terrain map", icon: Map },
  { id: "science", label: "Science tools", icon: ScanLine },
  { id: "vehicle", label: "Vehicle health", icon: Power },
  { id: "log", label: "Mission log", icon: Radio }
];

function Metric({ label, value, unit, percent, tone = "teal" }: { label: string; value: string; unit?: string; percent?: number; tone?: string }) {
  return <div className={`vehicle-metric ${tone}`}>
    <span>{label}</span><b>{value} {unit && <small>{unit}</small>}</b>
    {percent !== undefined && <i><span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></i>}
  </div>;
}

function SystemLamp({ label, online, note }: { label: string; online: boolean; note: string }) {
  return <div className="system-lamp"><i className={online ? "ok" : "warn"} /><span><b>{label}</b><small>{note}</small></span><strong>{online ? "NOMINAL" : "CHECK"}</strong></div>;
}

function MissionCard({ mission, selected, disabled, onSelect, onLaunch }: {
  mission: RoverMission; selected: boolean; disabled: boolean; onSelect: () => void; onLaunch: () => void;
}) {
  return <article className={`rover-mission-card ${selected ? "selected" : ""}`}>
    <button className="mission-select" onClick={onSelect} aria-pressed={selected}>
      <span className="mission-select-icon"><Map size={17} /></span>
      <span><b>{mission.title}</b><small>{mission.destination} · {mission.reward} science points</small></span>
      <em>{mission.status === "enroute" ? `${mission.solsRemaining} SOL LEFT` : mission.status.toUpperCase()}</em>
    </button>
    {mission.status === "available" && selected && <button className="rover-launch-button" disabled={disabled} onClick={onLaunch}>
      <Navigation size={15} /> {disabled ? "CHECKING SYSTEMS…" : "QUEUE EXPLORATION SORTIE"}
    </button>}
    {mission.status === "complete" && <div className="mission-complete-note"><Check size={13} /> Survey returned to the outpost</div>}
  </article>;
}

export default function VehicleCockpit({ vehicle, game, busy, onSelectVehicle, onQueueRoverMission, onAdvanceSol }: Props) {
  const spacecraft = vehicle === "spacecraft";
  const modules = spacecraft ? SPACECRAFT_MODULES : ROVER_MODULES;
  const [activeModule, setActiveModule] = useState<VehicleModule>(spacecraft ? "flight" : "driving");
  const [selectedMissionId, setSelectedMissionId] = useState(() => game.rover.find((mission) => mission.status === "available")?.id ?? game.rover[0]?.id ?? "");
  const [showChecklist, setShowChecklist] = useState(false);
  const selectedMission = game.rover.find((mission) => mission.id === selectedMissionId);
  const activeRoverMission = game.rover.find((mission) => mission.status === "enroute") ?? null;
  const pendingRover = game.pendingActions.some((action) => action.type === "send-rover");
  const garageOnline = game.buildings.find((building) => building.id === "garage")?.online ?? false;
  const queuedGarageToggle = [...game.pendingActions].reverse().find((action) => action.type === "toggle-building" && action.buildingId === "garage");
  const garageReady = queuedGarageToggle?.type === "toggle-building" ? queuedGarageToggle.online : garageOnline;
  const lifeSupportOnline = game.buildings.find((building) => building.id === "life-support")?.online ?? false;
  const solarOnline = game.buildings.find((building) => building.id === "solar")?.online ?? false;
  const oxygenPercent = Math.max(0, Math.min(100, game.resources.oxygenKg / game.resources.oxygenCapacityKg * 100));
  const waterPercent = Math.max(0, Math.min(100, game.resources.waterLiters / game.resources.waterCapacityLiters * 100));
  const batteryPercent = Math.max(0, Math.min(100, game.resources.batteryKwh / game.resources.batteryCapacityKwh * 100));
  const systemsReady = lifeSupportOnline && game.resources.oxygenKg > 0 && game.resources.cabinPressureKpa > 45;
  const systemRows = useMemo(() => [
    { label: "Life support", online: lifeSupportOnline, note: `O₂ ${game.resources.oxygenKg.toFixed(1)} kg · CO₂ ${game.resources.carbonDioxideKg.toFixed(1)} kg` },
    { label: "Electrical bus", online: game.resources.batteryKwh > 10, note: `${game.resources.batteryKwh.toFixed(0)} kWh stored` },
    { label: "Thermal control", online: game.resources.temperatureC > -20 && game.resources.temperatureC < 35, note: `Cabin ${game.resources.temperatureC.toFixed(1)} °C` },
    { label: "Surface link", online: true, note: "Outpost network connected" }
  ], [lifeSupportOnline, game.resources.oxygenKg, game.resources.carbonDioxideKg, game.resources.batteryKwh, game.resources.temperatureC]);

  function renderSpacecraftModule() {
    if (activeModule === "navigation") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">FLIGHT MANAGEMENT</span><h2>Navigation & mission route</h2><p>Campaign navigation view. Orbital mechanics and spacecraft trajectory are not simulated in this version.</p></div>
      <div className="trajectory-card"><div className="trajectory-stars" /><div className="trajectory-orbit orbit-one" /><div className="trajectory-orbit orbit-two" /><div className="trajectory-planet" /><div className="trajectory-ship"><Navigation size={22} /></div><span className="trajectory-label origin">MISSION START</span><span className="trajectory-label destination">GALE CRATER · MARS</span></div>
      <div className="vehicle-data-grid"><Metric label="MISSION LOCATION" value="Gale Crater" /><Metric label="CAMPAIGN SOL" value={`${game.sol} / ${game.totalSols}`} /><Metric label="SURFACE GRAVITY" value={game.environment.gravityMps2.toFixed(2)} unit="m/s²" /><Metric label="MARTIAN SOL" value={game.environment.solLengthHours.toFixed(2)} unit="hours" /></div>
    </div>;
    if (activeModule === "life-support") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">ENVIRONMENTAL CONTROL</span><h2>Life support & cabin atmosphere</h2><p>Readouts are shared with the outpost simulation and update after each completed Sol.</p></div>
      <div className="vehicle-data-grid"><Metric label="OXYGEN RESERVE" value={game.resources.oxygenKg.toFixed(1)} unit="kg" percent={oxygenPercent} /><Metric label="WATER RESERVE" value={game.resources.waterLiters.toFixed(0)} unit="L" percent={waterPercent} /><Metric label="CABIN PRESSURE" value={game.resources.cabinPressureKpa.toFixed(1)} unit="kPa" /><Metric label="CO₂ BUFFER" value={game.resources.carbonDioxideKg.toFixed(1)} unit="kg" tone="amber" /><Metric label="CABIN TEMPERATURE" value={game.resources.temperatureC.toFixed(1)} unit="°C" /></div>
      <div className="vehicle-info-note"><Shield size={16} /> Crew metabolic reference values are based on NASA BVAD. Habitat and equipment responses remain simplified game models.</div>
    </div>;
    if (activeModule === "power") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">ELECTRICAL POWER SYSTEM</span><h2>Power distribution</h2><p>Monitor stored energy and the current outpost generation balance.</p></div>
      <div className="power-core"><div className="power-ring" style={{ "--charge": `${batteryPercent}%` } as CSSProperties}><BatteryCharging size={30} /><b>{Math.round(batteryPercent)}%</b><small>BATTERY</small></div><div className="power-core-data"><Metric label="ENERGY STORED" value={game.resources.batteryKwh.toFixed(1)} unit="kWh" /><Metric label="CAPACITY" value={game.resources.batteryCapacityKwh.toFixed(0)} unit="kWh" /><Metric label="POWER BALANCE" value={`${game.resources.powerBalanceKw >= 0 ? "+" : ""}${game.resources.powerBalanceKw.toFixed(1)}`} unit="kW" tone={game.resources.powerBalanceKw >= 0 ? "teal" : "amber"} /></div></div>
      <div className="vehicle-info-note"><Zap size={16} /> Solar array is {solarOnline ? "online" : "in standby"}. Power production and demand are recalculated by the server when the Sol advances.</div>
    </div>;
    if (activeModule === "communications") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">DEEP SPACE NETWORK</span><h2>Communications</h2><p>Mission communications panel linked to the current outpost session.</p></div>
      <div className="comms-status"><div className="comms-wave"><RadioTower size={34} /></div><div><b>OUTPOST LINK AVAILABLE</b><small>Guest campaign · Local simulation connection</small></div><span className="comms-live"><i /> CONNECTED</span></div>
      <div className="comms-message"><span>MISSION CONTROL · SYSTEM</span><p>Telemetry packets are synchronized with the current campaign state. This build does not simulate real radio delay or deep-space signal loss.</p></div>
      <div className="vehicle-data-grid"><Metric label="CURRENT SOL" value={String(game.sol).padStart(2, "0")} /><Metric label="CAMPAIGN STATUS" value={game.status.toUpperCase()} /><Metric label="PENDING ORDERS" value={String(game.pendingActions.length)} /></div>
    </div>;
    return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">COMMANDER FLIGHT DECK</span><h2>Spacecraft systems overview</h2><p>Mission-ready cockpit view for crew transport, environmental monitoring and electrical systems.</p></div>
      <div className="flight-deck-grid">
        <div className="flight-primary-readout"><span>MISSION PHASE</span><b> MARS SURFACE OPERATIONS</b><small>Campaign {game.sol} of {game.totalSols} Sols</small></div>
        <Metric label="O₂ RESERVE" value={game.resources.oxygenKg.toFixed(1)} unit="kg" percent={oxygenPercent} />
        <Metric label="CABIN PRESSURE" value={game.resources.cabinPressureKpa.toFixed(1)} unit="kPa" />
        <Metric label="BATTERY" value={game.resources.batteryKwh.toFixed(0)} unit="kWh" percent={batteryPercent} />
      </div>
      <div className="systems-list">{systemRows.map((row) => <SystemLamp key={row.label} {...row} />)}</div>
      <button className="checklist-toggle" onClick={() => setShowChecklist((value) => !value)}>{showChecklist ? "Hide" : "Open"} pre-operation checklist <ChevronRight size={15} className={showChecklist ? "rotate-90" : ""} /></button>
      {showChecklist && <div className="checklist-grid"><span><Check size={13} /> Cabin pressure monitored</span><span><Check size={13} /> Oxygen reserve available</span><span>{batteryPercent > 15 ? <Check size={13} /> : <AlertTriangle size={13} />} Electrical reserve reviewed</span><span><Check size={13} /> Campaign link synchronized</span></div>}
      <div className="vehicle-info-note"><AlertTriangle size={16} /> The spacecraft cockpit is an interactive mission-systems interface. Independent orbital flight dynamics, propulsion and attitude control are not implemented yet.</div>
    </div>;
  }

  function renderRoverModule() {
    if (activeModule === "terrain") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">SURFACE CARTOGRAPHY</span><h2>Terrain & route planning</h2><p>Choose a predefined survey destination. The current map is a Gale-inspired schematic, not a georeferenced navigation map.</p></div>
      <div className="rover-map"><div className="map-contours" /><div className="map-route" /><span className="map-node home">OUTPOST</span><span className="map-node ridge">RIDGE</span><span className="map-node dune">DUNE</span><span className="map-node basalt">BASALT</span><span className="map-rover-pin"><Navigation size={16} /></span></div>
      <div className="vehicle-data-grid"><Metric label="SITE" value="Gale Crater" /><Metric label="SURFACE GRAVITY" value={game.environment.gravityMps2.toFixed(2)} unit="m/s²" /><Metric label="OUTDOOR TEMP. MODEL" value={game.environment.outsideTemperatureC.toFixed(0)} unit="°C" /><Metric label="DUST SCENARIO" value={game.environment.dustStorm ? "STORM" : "CLEAR"} /></div>
    </div>;
    if (activeModule === "science") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">SCIENCE PAYLOAD</span><h2>Scientific instruments</h2><p>Plan a surface survey and return its science data to the colony.</p></div>
      <div className="instrument-grid"><article><ScanLine size={24} /><b>Terrain imaging</b><small>Surface morphology and route context</small></article><article><FlaskConical size={24} /><b>Sample collection</b><small>Geological samples on return</small></article><article><Activity size={24} /><b>Environmental sensing</b><small>Temperature and dust scenario readouts</small></article></div>
      <div className="vehicle-info-note"><FlaskConical size={16} /> These instruments are gameplay representations. No real rover sensor stream or sample chemistry analysis is connected.</div>
    </div>;
    if (activeModule === "vehicle") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">MOBILITY & HEALTH</span><h2>Rover vehicle systems</h2><p>Surface vehicle readiness and support systems.</p></div>
      <div className="systems-list"><SystemLamp label="Rover garage" online={garageReady} note={garageReady ? "Maintenance support available" : "Garage offline — dispatch unavailable"} /><SystemLamp label="Battery reserve" online={game.resources.batteryKwh >= 24} note={`${game.resources.batteryKwh.toFixed(0)} kWh · 24 kWh sortie requirement`} /><SystemLamp label="Provision reserve" online={game.resources.foodKg >= 8} note={`${game.resources.foodKg.toFixed(1)} kg dry solids · 8 kg sortie requirement`} /><SystemLamp label="Surface conditions" online={!game.environment.dustStorm} note={game.environment.dustStorm ? "Dust-storm scenario active" : "No dust-storm scenario active"} /></div>
      <div className="vehicle-info-note"><AlertTriangle size={16} /> The game uses simplified mission readiness checks. It does not calculate real rover range, wheel traction or thermal limits.</div>
    </div>;
    if (activeModule === "log") return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">OPERATIONS RECORD</span><h2>Rover mission log</h2><p>Results returned by the campaign simulation.</p></div>
      <div className="mission-log-list">{game.rover.map((mission) => <div key={mission.id}><span className={`mission-log-dot ${mission.status}`} /><span><b>{mission.title}</b><small>{mission.destination}</small></span><strong>{mission.status.toUpperCase()}</strong></div>)}</div>
      <div className="vehicle-info-note"><Radio size={16} /> Rover mission progress advances when you advance the campaign by one Sol.</div>
    </div>;
    return <div className="vehicle-module-content">
      <div className="module-title"><span className="module-kicker">CREWED SURFACE EXPLORATION</span><h2>Mars Rover driving console</h2><p>Select a survey destination and dispatch the rover. Travel and return are resolved by the turn-based campaign simulation.</p></div>
      <div className="drive-readouts"><div className="drive-speed"><span>VEHICLE MODE</span><b>{activeRoverMission ? "EN ROUTE" : "STATIONARY"}</b><small>{activeRoverMission ? `${activeRoverMission.solsRemaining} SOL REMAINING` : "AWAITING MISSION ORDER"}</small></div><Metric label="BATTERY RESERVE" value={game.resources.batteryKwh.toFixed(0)} unit="kWh" percent={batteryPercent} /><Metric label="PROVISIONS" value={game.resources.foodKg.toFixed(0)} unit="kg" percent={Math.max(0, Math.min(100, game.resources.foodKg / game.resources.foodCapacityKg * 100))} /></div>
      <div className="rover-mission-picker"><div className="rover-picker-heading"><span>AVAILABLE SURFACE SORTIES</span><small>{game.rover.filter((mission) => mission.status === "available").length} READY</small></div>
        {game.rover.map((mission) => <MissionCard key={mission.id} mission={mission} selected={mission.id === selectedMissionId} disabled={busy || pendingRover || Boolean(activeRoverMission) || !garageReady || game.resources.batteryKwh < 24 || game.resources.foodKg < 8} onSelect={() => setSelectedMissionId(mission.id)} onLaunch={() => onQueueRoverMission(mission.id)} />)}
      </div>
      <div className="vehicle-info-note"><Navigation size={16} /> The rover does not use real-time driving controls. Orders are queued and resolved over the next campaign Sols.</div>
    </div>;
  }

  return <section className={`vehicle-console ${spacecraft ? "spacecraft-console" : "rover-console"}`}>
    <header className="vehicle-header">
      <div className="vehicle-title-lockup"><span className="vehicle-emblem">{spacecraft ? <Orbit size={21} /> : <Compass size={21} />}</span><span><b>{spacecraft ? "CREW SPACECRAFT" : "MARS EXPLORATION ROVER"}</b><small>{spacecraft ? "MISSION SYSTEMS CONTROL" : "SURFACE MOBILITY & SCIENCE"} · GALE CRATER</small></span></div>
      <div className="vehicle-switcher"><button onClick={() => onSelectVehicle("outpost")}>OUTPOST</button><button className={spacecraft ? "active" : ""} onClick={() => onSelectVehicle("spacecraft")}>SPACECRAFT</button><button className={!spacecraft ? "active" : ""} onClick={() => onSelectVehicle("rover")}>ROVER</button></div>
      <div className="vehicle-header-status"><i /> SOL {String(game.sol).padStart(2, "0")} / {game.totalSols}</div>
    </header>

    <div className="vehicle-cockpit-frame">
      <nav className="vehicle-rail" aria-label={`${spacecraft ? "Spacecraft" : "Rover"} controls`}>
        {modules.map(({ id, label, icon: Icon }) => <button key={id} className={activeModule === id ? "active" : ""} onClick={() => setActiveModule(id)} aria-pressed={activeModule === id}><Icon size={18} /><span>{label}</span></button>)}
        <div className="vehicle-rail-bottom"><span>MISSION LINK</span><i /></div>
      </nav>

      <div className="vehicle-main-column">
        <div className={`vehicle-windshield ${spacecraft ? "space-windshield" : "mars-windshield"}`}>
          <div className="windshield-sky" /><div className="windshield-planet" /><div className="windshield-mountains back" /><div className="windshield-mountains front" /><div className="windshield-ground" />
          <div className="windshield-topline"><span>{spacecraft ? "EXTERNAL VIEW · MARS MISSION VESSEL" : "EXTERNAL VIEW · GALE CRATER"}</span><span>{spacecraft ? "FLIGHT SYSTEMS · CONCEPT INTERFACE" : game.environment.dustStorm ? "DUST EVENT SCENARIO" : "SURFACE CONDITIONS · CLEAR SCENARIO"}</span></div>
          <div className="target-reticle"><i /><b /><span>{spacecraft ? "MARS" : selectedMission?.destination.toUpperCase() ?? "WAYPOINT"}</span></div>
          <div className="windshield-coordinate">{spacecraft ? "MISSION CONTROL / SURFACE CAMPAIGN" : "4.5895° S · 137.4417° E / FICTIONAL MAP"}</div>
          <div className="cockpit-glass-rim" />
        </div>
        <div className="cockpit-dashboard">
          <div className="dashboard-instrument"><span>{spacecraft ? "MISSION PHASE" : "DRIVE MODE"}</span><b>{spacecraft ? "SURFACE OPS" : activeRoverMission ? "EN ROUTE" : "STATIONARY"}</b><small>{spacecraft ? "MARS CAMPAIGN" : activeRoverMission ? `${activeRoverMission.solsRemaining} SOL REMAINING` : "ROUTE SELECT"}</small></div>
          <div className="dashboard-instrument"><span>{spacecraft ? "CABIN PRESSURE" : "SURFACE TEMP."}</span><b>{spacecraft ? `${game.resources.cabinPressureKpa.toFixed(1)} kPa` : `${game.environment.outsideTemperatureC.toFixed(0)} °C`}</b><small>{spacecraft ? "HABITAT TELEMETRY" : "SCENARIO MODEL"}</small></div>
          <div className="dashboard-instrument"><span>{spacecraft ? "O₂ RESERVE" : "BATTERY RESERVE"}</span><b>{spacecraft ? `${game.resources.oxygenKg.toFixed(1)} kg` : `${game.resources.batteryKwh.toFixed(0)} kWh`}</b><small>{spacecraft ? `${Math.round(oxygenPercent)}% CAPACITY` : `${Math.round(batteryPercent)}% CAPACITY`}</small></div>
          <div className="dashboard-instrument"><span>{spacecraft ? "ELECTRICAL BUS" : "DUST OPTICAL DEPTH"}</span><b>{spacecraft ? `${game.resources.powerBalanceKw >= 0 ? "+" : ""}${game.resources.powerBalanceKw.toFixed(1)} kW` : `τ ${game.environment.dustOpticalDepth.toFixed(1)}`}</b><small>{spacecraft ? "CURRENT POWER BALANCE" : "SCENARIO INPUT"}</small></div>
        </div>
        <div className="vehicle-workspace">
          <div className="vehicle-workspace-heading"><div><span>{spacecraft ? "SPACECRAFT SYSTEMS" : "ROVER OPERATIONS"}</span><h1>{modules.find((module) => module.id === activeModule)?.label}</h1></div><span className="view-label">{spacecraft ? "FLIGHT DECK / MFD" : "SURFACE CONSOLE / MFD"}</span></div>
          {spacecraft ? renderSpacecraftModule() : renderRoverModule()}
        </div>
      </div>

      <aside className="vehicle-side-console">
        <div className="side-console-title"><span>{spacecraft ? "VEHICLE STATUS" : "SURFACE VEHICLE STATUS"}</span><b className={spacecraft ? (systemsReady ? "nominal" : "attention") : (garageReady ? "nominal" : "attention")}><i />{spacecraft ? (systemsReady ? "NOMINAL" : "ATTENTION") : (garageReady ? "GARAGE READY" : "GARAGE OFFLINE")}</b></div>
        {spacecraft ? <>
          <Metric label="OXYGEN" value={`${game.resources.oxygenKg.toFixed(1)} kg`} percent={oxygenPercent} />
          <Metric label="WATER" value={`${game.resources.waterLiters.toFixed(0)} L`} percent={waterPercent} />
          <Metric label="BATTERY" value={`${game.resources.batteryKwh.toFixed(0)} kWh`} percent={batteryPercent} />
          <Metric label="RADIATION INDEX" value={`${Math.round(game.resources.radiationRisk)} / 100`} tone="amber" />
          <div className="side-console-divider" />
          {systemRows.map((row) => <SystemLamp key={row.label} {...row} />)}
        </> : <>
          <Metric label="SORTIE REQUIREMENT" value="24 kWh + 8 kg" />
          <Metric label="ROUTE DESTINATION" value={selectedMission?.destination ?? "Not selected"} />
          <div className="side-console-divider" />
          <SystemLamp label="Rover garage" online={garageReady} note="Dispatch support" />
          <SystemLamp label="Power reserve" online={game.resources.batteryKwh >= 24} note={`${game.resources.batteryKwh.toFixed(0)} kWh stored`} />
          <SystemLamp label="Provisions" online={game.resources.foodKg >= 8} note={`${game.resources.foodKg.toFixed(0)} kg available`} />
          <SystemLamp label="Dust conditions" online={!game.environment.dustStorm} note={game.environment.dustStorm ? "Dust scenario active" : "Clear scenario"} />
          <button className="side-action" onClick={() => setActiveModule("terrain")}><Map size={15} /> OPEN TERRAIN MAP</button>
        </>}
        <div className="side-console-bottom"><span>DATA SOURCE</span><b>CAMPAIGN SIMULATION</b><small>Reference values + declared game assumptions</small></div>
      </aside>
    </div>

    <footer className="vehicle-footer">
      <div className="vehicle-footer-left"><span className="footer-status-dot" /> {spacecraft ? "SPACECRAFT SYSTEMS LINKED" : "ROVER CONTROL LINK READY"}<small>Values synchronize after each completed Sol.</small></div>
      <div className="vehicle-footer-actions">
        {!spacecraft && selectedMission?.status === "available" && <button className="footer-quiet" disabled={busy || pendingRover || Boolean(activeRoverMission) || !garageReady || game.resources.batteryKwh < 24 || game.resources.foodKg < 8} onClick={() => onQueueRoverMission(selectedMission.id)}>QUEUE SORTIE <ChevronRight size={14} /></button>}
        <button className="footer-quiet" disabled={busy || game.status !== "active"} onClick={onAdvanceSol}>ADVANCE SOL</button>
        <button className="footer-return" onClick={() => onSelectVehicle("outpost")}><ArrowLeft size={15} /> RETURN TO OUTPOST</button>
      </div>
    </footer>
  </section>;
}

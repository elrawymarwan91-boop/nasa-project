export const CAMPAIGN_ID = "gale-15-sol";
export const CAMPAIGN_LENGTH = 15;

export type BuildingId =
  | "habitat"
  | "solar"
  | "battery"
  | "life-support"
  | "water-recovery"
  | "greenhouse"
  | "shelter"
  | "garage";

export type Building = {
  id: BuildingId;
  name: string;
  subtitle: string;
  description: string;
  x: number;
  y: number;
  level: number;
  online: boolean;
  condition: number;
};

export type CrewTask = "maintenance" | "biology" | "research" | "rover";

export type CrewMember = {
  id: string;
  name: string;
  role: string;
  task: CrewTask;
  condition: number;
};

export type GameEvent = {
  id: string;
  code: string;
  title: string;
  severity: "low" | "medium" | "high";
  description: string;
  choices: Array<{
    id: string;
    label: string;
    detail: string;
    cost: Partial<Record<"batteryKwh" | "waterLiters" | "foodKg", number>>;
  }>;
  resolved: boolean;
};

export type RoverMission = {
  id: string;
  title: string;
  destination: string;
  status: "available" | "enroute" | "complete";
  solsRemaining: number;
  reward: number;
};

export type TurnReport = {
  sol: number;
  summary: string;
  changes: Record<string, number>;
  completedActivities: string[];
  eventTitle: string | null;
};

export type GameEnvironment = {
  gravityMps2: number;
  solLengthHours: number;
  solarIrradianceTopWm2: number;
  solarIrradianceSurfaceWm2: number;
  dustOpticalDepth: number;
  equivalentPeakSunHours: number;
  outsideTemperatureC: number;
  dustStorm: boolean;
  solarArrayAreaM2: number;
  solarPeakPowerKw: number;
  solarEnergyKwh: number;
  energyDemandKwh: number;
};

export type GameState = {
  environment: GameEnvironment;
  phase: "briefing" | "game" | "debrief";
  status: "active" | "won" | "lost";
  sol: number;
  totalSols: number;
  stateVersion: number;
  randomSeed: number;
  resources: {
    oxygenKg: number;
    oxygenCapacityKg: number;
    carbonDioxideKg: number;
    cabinPressureKpa: number;
    waterLiters: number;
    waterCapacityLiters: number;
    foodKg: number;
    foodCapacityKg: number;
    batteryKwh: number;
    batteryCapacityKwh: number;
    powerBalanceKw: number;
    sciencePoints: number;
    radiationRisk: number;
    temperatureC: number;
  };
  buildings: Building[];
  crew: CrewMember[];
  rover: RoverMission[];
  events: GameEvent[];
  pendingActions: QueuedAction[];
  history: TurnReport[];
  objectives: {
    survive: boolean;
    science: boolean;
    rover: boolean;
  };
  lastReport: TurnReport | null;
};

export type PlayerAction =
  | { type: "toggle-building"; buildingId: BuildingId; online: boolean }
  | { type: "upgrade-building"; buildingId: BuildingId }
  | { type: "assign-crew"; crewId: string; task: CrewTask }
  | { type: "send-rover"; missionId: string }
  | { type: "resolve-event"; eventId: string; choiceId: string };

export type QueuedAction = PlayerAction & { id: string };

export const BUILDINGS: Building[] = [
  { id: "habitat", name: "Habitat", subtitle: "Crew quarters", description: "Pressurized living quarters. The crew consumes oxygen, water and food every Sol.", x: 0, y: 1, level: 1, online: true, condition: 94 },
  { id: "solar", name: "Solar Array", subtitle: "Power generation", description: "Produces electrical power; output is reduced during dust storms.", x: 2, y: 0, level: 1, online: true, condition: 88 },
  { id: "battery", name: "Battery Storage", subtitle: "Energy reserve", description: "Stores energy in kWh for use when production falls short.", x: 4, y: 1, level: 1, online: true, condition: 92 },
  { id: "life-support", name: "Life Support", subtitle: "O₂ / CO₂ control", description: "Produces oxygen and removes carbon dioxide from the cabin atmosphere.", x: 1, y: 3, level: 1, online: true, condition: 91 },
  { id: "water-recovery", name: "Water Recovery", subtitle: "Water recycling", description: "Recovers part of the crew's daily water use. Recovery depends on available power.", x: 3, y: 4, level: 1, online: true, condition: 89 },
  { id: "greenhouse", name: "Greenhouse", subtitle: "Crop growth", description: "Uses water and power to grow food over multiple Sols.", x: 5, y: 3, level: 1, online: true, condition: 86 },
  { id: "shelter", name: "Radiation Shelter", subtitle: "Storm protection", description: "A shielded refuge that reduces the game's abstract radiation-risk indicator.", x: 2, y: 2, level: 1, online: true, condition: 90 },
  { id: "garage", name: "Rover Garage", subtitle: "Surface science", description: "Maintains the rover and supports short-range science sorties.", x: 4, y: 2, level: 1, online: true, condition: 87 }
];

export const CREW: CrewMember[] = [
  { id: "amara", name: "Amara Voss", role: "Commander", task: "maintenance", condition: 100 },
  { id: "liam", name: "Liam Chen", role: "Engineer", task: "maintenance", condition: 100 },
  { id: "ines", name: "Ines Okafor", role: "Biologist", task: "biology", condition: 100 },
  { id: "mateo", name: "Mateo Ruiz", role: "Mission specialist", task: "research", condition: 100 }
];

export const ROVER_MISSIONS: RoverMission[] = [
  { id: "ridge", title: "Gale Ridge Survey", destination: "Western ridge", status: "available", solsRemaining: 0, reward: 18 },
  { id: "dune", title: "Dune Traverse", destination: "Namib dune field", status: "available", solsRemaining: 0, reward: 14 },
  { id: "basalt", title: "Basalt Sampling", destination: "South basalt shelf", status: "available", solsRemaining: 0, reward: 16 }
];

export const INITIAL_RESOURCES: GameState["resources"] = {
  oxygenKg: 164,
  oxygenCapacityKg: 200,
  carbonDioxideKg: 8,
  cabinPressureKpa: 101.3,
  waterLiters: 1500,
  waterCapacityLiters: 2000,
  foodKg: 340,
  foodCapacityKg: 500,
  batteryKwh: 360,
  batteryCapacityKwh: 500,
  powerBalanceKw: 0,
  sciencePoints: 0,
  radiationRisk: 12,
  temperatureC: 21
};

export const SCIENCE_CARDS = [
  {
    id: "mars-planet-constants",
    title: "Mars: gravity, sunlight and time",
    classification: "NASA_REFERENCE",
    text: "The simulation uses Mars mean surface gravity of 3.73 m/s², mean solar irradiance at the planet of 586.2 W/m², and a 24.6597-hour mean solar day. These are planetary reference constants, not local weather observations.",
    source: "NASA/NSSDC Mars Fact Sheet",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html"
  },
  {
    id: "crew-metabolism",
    title: "Crew life-support reference loads",
    classification: "NASA_BVAD_REFERENCE",
    text: "NASA BVAD Rev. 2 (2022) lists nominal reference values of 0.895 kg O₂, 1.085 kg CO₂ generated, 0.800 kg food dry solids, and 3.217 kg potable water per crewmember-day. These are reference planning values; they are not a complete Mars habitat design.",
    source: "NASA Life Support Baseline Values and Assumptions Document, Rev. 2",
    url: "https://ntrs.nasa.gov/citations/20210024855"
  },
  {
    id: "lettuce-growth",
    title: "Greenhouse harvest is area-based",
    classification: "NASA_BVAD_REFERENCE",
    text: "NASA BVAD Table 4-90 lists lettuce edible dry-biomass productivity at 6.57 g/m²·day and a nominal growth period of 28 days after planting. This game starts with a mature crop and uses the published daily productivity as a simplified steady-harvest model.",
    source: "NASA BVAD Rev. 2, Tables 4-89 and 4-90",
    url: "https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf"
  },
  {
    id: "solar-dust-model",
    title: "Dust reduces available solar energy",
    classification: "DERIVED_WITH_GAME_ASSUMPTIONS",
    text: "A Beer–Lambert style attenuation approximation, I = I₀ × e⁻ᵗᵃᵘ, is used to make the impact of atmospheric dust visible. The selected optical depths and effective peak-sun hours are scenario inputs, not a live Gale forecast. NASA reports optical depth near 0.5 in relatively clear conditions and around 2–4 during dust storms.",
    source: "NASA Mars Solar Power Characteristics report",
    url: "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/d/D-20757.pdf"
  },
  {
    id: "radiation-context",
    title: "Radiation risk is an educational index",
    classification: "GAME_ASSUMPTION",
    text: "The colony's 0–100 radiation-risk indicator is an ordinal gameplay abstraction. It is not a measured dose, an mSv value, or a prediction of crew exposure. Curiosity RAD observations are useful scientific context, but habitat shielding and crew dosimetry are not calculated here.",
    source: "NASA PDS Curiosity RAD dataset",
    url: "https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MSL-M-RAD-3-RDR-V1.0"
  },
  {
    id: "mars-terrain",
    title: "Gale-inspired terrain, not a survey map",
    classification: "GAME_ASSUMPTION",
    text: "The colony scene is original procedural game artwork inspired by Mars. It is not a location-accurate reconstruction of Gale Crater. NASA Mars Trek is the reference source for future terrain and elevation integration.",
    source: "NASA Mars Trek",
    url: "https://trek.nasa.gov/mars/"
  },
  {
    id: "solar-weather",
    title: "Solar events and Mars exposure are different datasets",
    classification: "SOURCE_CONTEXT_ONLY",
    text: "DONKI reports solar and heliophysics events. The game does not translate Earth-orbit event reports directly into a Mars surface dose. The solar-alert event is a scripted scenario until an appropriate Mars-specific model and data pipeline are implemented.",
    source: "NASA CCMC DONKI",
    url: "https://ccmc.gsfc.nasa.gov/tools/DONKI/"
  }
] as const;

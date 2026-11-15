import { GAME_ASSUMPTIONS, SCIENTIFIC_REFERENCE, SIMULATION } from "../game/config.js";

export const DATA_SOURCES = [
  {
    slug: "nasa-mars-fact-sheet",
    name: "NASA Mars Fact Sheet",
    provider: "NASA / NSSDC",
    officialUrl: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html",
    fieldsUsed: [
      "mean surface gravity: 3.73 m/s²",
      "solar irradiance at mean Mars-Sun distance: 586.2 W/m²",
      "length of mean solar day (Sol): 24.6597 h"
    ],
    units: "m/s², W/m², hours",
    datasetVersion: "Fact Sheet page accessed 2026-11-15",
    classification: "NASA_REFERENCE",
    limitations: "The irradiance is a planetary reference at Mars' mean orbital distance, not a Gale surface measurement. Atmospheric attenuation is modelled separately.",
    attribution: "NASA National Space Science Data Center (NSSDC), Mars Fact Sheet",
    gameplayUse: "Seeds Mars gravity, top-of-atmosphere solar irradiance, and Sol duration."
  },
  {
    slug: "nasa-bvad-rev2",
    name: "Life Support Baseline Values and Assumptions Document, Rev. 2",
    provider: "NASA Johnson Space Center / NTRS",
    officialUrl: "https://ntrs.nasa.gov/citations/20210024855",
    fieldsUsed: [
      "oxygen consumed: 0.895 kg/crewmember-day",
      "carbon dioxide generated: 1.085 kg/crewmember-day",
      "food solids consumed: 0.800 kg/crewmember-day",
      "potable water content: 3.217 kg/crewmember-day",
      "lettuce edible dry biomass productivity: 6.57 g/m²-day",
      "lettuce nominal growth period: 28 days after planting"
    ],
    units: "kg/crewmember-day, g/m²-day, days",
    datasetVersion: "NASA/TP-2015-218570/REV2, February 2022",
    classification: "NASA_BVAD_REFERENCE",
    limitations: "BVAD is a reference document for life-support analysis, not a complete Mars surface habitat design. The game begins with a mature lettuce crop and uses a simplified steady-harvest estimate. Hygiene loop loads and equipment ratings are separate game assumptions.",
    attribution: "Ewert, Chen, and Powell, NASA/TP-2015-218570/REV2, February 2022",
    gameplayUse: "Supplies nominal crew metabolic loads and a mature lettuce dry-biomass productivity reference."
  },
  {
    slug: "mars-solar-dust-reference",
    name: "Mars Solar Power Characteristics",
    provider: "NASA Advanced Radioisotope Power Systems Team",
    officialUrl: "https://science.nasa.gov/wp-content/uploads/2023/09/D-20757.pdf",
    fieldsUsed: [
      "normal/quiescent optical depth around 0.5",
      "occasional dust-storm optical depth can increase into the 2–4 range"
    ],
    units: "dimensionless optical depth",
    datasetVersion: "NASA technical report; publication archive",
    classification: "NASA_ENGINEERING_REFERENCE",
    limitations: "The project chooses tau=0.5 for its clear scenario and tau=3.0 for its storm scenario. Those are scenario values within the reported ranges, not measured Gale weather inputs.",
    attribution: "NASA Advanced Radioisotope Power Systems Team Report, Part II, Mars Solar Power Characteristics",
    gameplayUse: "Constrains the clear/dust-storm attenuation scenarios used by the simplified Beer–Lambert solar model."
  },
  {
    slug: "curiosity-rad-pds",
    name: "Mars Science Laboratory Radiation Assessment Detector (RAD) RDR V1.0",
    provider: "NASA Planetary Data System",
    officialUrl: "https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=MSL-M-RAD-3-RDR-V1.0",
    fieldsUsed: [],
    units: "No raw dose records ingested in this version",
    datasetVersion: "MSL-M-RAD-3-RDR-V1.0",
    classification: "SOURCE_CONTEXT_ONLY",
    limitations: "The current game does not claim an absolute crew dose or shield attenuation. The displayed 0–100 value is an ordinal gameplay risk index, not mSv or a measurement.",
    attribution: "NASA Planetary Data System, Mars Science Laboratory RAD RDR",
    gameplayUse: "Science reference only; a future version may ingest calibrated RAD data with proper instrument context."
  },
  {
    slug: "nasa-mars-trek",
    name: "NASA Mars Trek",
    provider: "NASA",
    officialUrl: "https://trek.nasa.gov/mars/",
    fieldsUsed: [],
    units: "No map tiles or elevation rasters bundled",
    datasetVersion: "Service reference checked 2026-11-15",
    classification: "SOURCE_CONTEXT_ONLY",
    limitations: "The current Phaser map is fictional and Gale-inspired. It is not a coordinate-accurate Mars Trek basemap.",
    attribution: "NASA Mars Trek",
    gameplayUse: "Reference for a future terrain, elevation, and landing-site integration."
  },
  {
    slug: "nasa-donki",
    name: "NASA DONKI",
    provider: "NASA Community Coordinated Modeling Center",
    officialUrl: "https://ccmc.gsfc.nasa.gov/tools/DONKI/",
    fieldsUsed: [],
    units: "No event feed ingested",
    datasetVersion: "Service reference checked 2026-11-15",
    classification: "SOURCE_CONTEXT_ONLY",
    limitations: "Earth-observed heliophysics events are not directly converted into a Mars surface radiation dose. Solar alerts currently remain authored learning scenarios.",
    attribution: "NASA CCMC Space Weather Database Of Notifications, Knowledge, Information (DONKI)",
    gameplayUse: "Educational reference for event types; no live operational alerting."
  },
  {
    slug: "nasa-osdr",
    name: "NASA Open Science Data Repository",
    provider: "NASA",
    officialUrl: "https://osdr.nasa.gov/",
    fieldsUsed: [],
    units: "No experiment data ingested",
    datasetVersion: "Repository reference checked 2026-11-15",
    classification: "SOURCE_CONTEXT_ONLY",
    limitations: "Space biology experiments are not treated as direct predictors of Mars colony health or plant yield in this release.",
    attribution: "NASA Open Science Data Repository",
    gameplayUse: "Source for future educational research cards only."
  },
  {
    slug: "csa-stem-food-production",
    name: "Canadian Space Agency STEM Resources: Food Production on the Moon",
    provider: "Canadian Space Agency",
    officialUrl: "https://www.asc-csa.gc.ca/eng/astronomy/moon/food-production-on-the-moon-and-in-remote-areas/",
    fieldsUsed: [],
    units: "Educational reference; no machine-readable dataset ingested",
    datasetVersion: "Page reference checked 2026-11-15",
    classification: "SOURCE_CONTEXT_ONLY",
    limitations: "This is educational and design context, not a numeric crop dataset used by the simulation.",
    attribution: "Canadian Space Agency",
    gameplayUse: "Background reading for the food-production learning system."
  }
] as const;

export const PHYSICS_CONSTANTS = {
  reference: SCIENTIFIC_REFERENCE,
  scenario: {
    clearDustOpticalDepth: GAME_ASSUMPTIONS.clearDustOpticalDepth,
    stormDustOpticalDepth: GAME_ASSUMPTIONS.stormDustOpticalDepth,
    dustStormProbability: GAME_ASSUMPTIONS.dustStormProbability,
    equivalentPeakSunHoursPerSol: GAME_ASSUMPTIONS.equivalentPeakSunHoursPerSol,
    solarArrayAreaM2PerLevel: GAME_ASSUMPTIONS.solarArrayAreaM2PerLevel,
    photovoltaicEfficiency: GAME_ASSUMPTIONS.photovoltaicEfficiency,
    outsideTemperatureC: GAME_ASSUMPTIONS.outsideTemperatureC,
    habitatVolumeM3: GAME_ASSUMPTIONS.habitatVolumeM3,
    hygieneLoopLitersPerCrewSol: GAME_ASSUMPTIONS.potableHygieneLoopLitersPerCrewSol,
    hygieneWaterRecoveryFraction: GAME_ASSUMPTIONS.hygieneWaterRecoveryFraction,
    greenhouseAreaM2: GAME_ASSUMPTIONS.greenhouseAreaM2,
    greenhouseWaterMakeupLitersPerSol: GAME_ASSUMPTIONS.greenhouseWaterMakeupLitersPerSol,
    electrolysisWaterKgPerOxygenKg: GAME_ASSUMPTIONS.electrolysisWaterKgPerOxygenKg,
    electrolysisEnergyKwhPerOxygenKg: GAME_ASSUMPTIONS.electrolysisEnergyKwhPerOxygenKg,
    batteryChargeEfficiency: GAME_ASSUMPTIONS.batteryChargeEfficiency,
    batteryDischargeEfficiency: GAME_ASSUMPTIONS.batteryDischargeEfficiency
  },
  equipment: {
    nominalCrewCount: SIMULATION.crew,
    oxygenProductionKgPerSol: SIMULATION.oxygenProductionKgPerSol,
    carbonDioxideScrubbingKgPerSol: SIMULATION.co2ScrubKgPerSol,
    averagePowerLoadsKw: {
      fixed: SIMULATION.fixedPowerKw,
      lifeSupport: SIMULATION.lifeSupportPowerKw,
      waterRecovery: SIMULATION.waterRecoveryPowerKw,
      greenhouse: SIMULATION.greenhousePowerKw,
      thermalControl: SIMULATION.thermalControlPowerKw,
      rover: SIMULATION.roverPowerKw
    },
    batteryChargeEfficiency: GAME_ASSUMPTIONS.batteryChargeEfficiency,
    batteryDischargeEfficiency: GAME_ASSUMPTIONS.batteryDischargeEfficiency,
    classification: "GAME_ASSUMPTION"
  },
  formulaNotes: {
    solarEnergy: "E_solar[kWh] = I_TOA[W/m²] × exp(-tau) × area[m²] × efficiency × equivalent_peak_sun_hours[h] / 1000",
    electricalDemand: "E_demand[kWh] = average_load[kW] × Sol_length[h]",
    electrolysisWater: "H2O mass = O2 mass × 18/16 (stoichiometric mass ratio)",
    cabinPressure: "Delta P = Delta n × R × T / V, ideal-gas approximation for O2 and CO2 only",
    greenhouse: "Dry lettuce harvest[kg/Sol] = 0.00657[kg/m²/Sol] × greenhouse area[m²] × condition × biology staffing × power fraction",
    radiation: "0–100 ordinal risk index only; not dose, mSv, or predicted exposure"
  }
} as const;

# Outpost Commander — simulation model

## Scope and scientific status

The campaign is a 15-Sol, turn-based educational simulation set in a fictional Gale-Crater-inspired outpost. The server is authoritative: clients queue actions, while the backend advances the Sol and returns the resulting state.

This is a transparent first-order teaching model, not a validated engineering design, mission operations tool, local Gale weather forecast, or astronaut health model. Every model input is labelled as one of:

- `NASA_REFERENCE`: a planetary reference value from NASA/NSSDC.
- `NASA_BVAD_REFERENCE`: a nominal human-life-support or crop reference from NASA's Life Support Baseline Values and Assumptions Document, Rev. 2 (2022).
- `NASA_ENGINEERING_REFERENCE`: a range or engineering context from NASA technical material.
- `DERIVED_WITH_GAME_ASSUMPTIONS`: a simplified equation using published context and explicit scenario inputs.
- `GAME_ASSUMPTION`: a value selected for this campaign, not a measured Mars condition or flight-hardware specification.
- `SOURCE_CONTEXT_ONLY`: a linked resource that is not ingested as numerical game data.

## Data actually used

### Planetary constants — NASA/NSSDC Mars Fact Sheet

| Quantity | Value | Unit | Use |
|---|---:|---|---|
| Mean surface gravity | 3.73 | m/s² | Planet context and environment telemetry |
| Mean solar irradiance at mean Mars-Sun distance | 586.2 | W/m² | Solar model input at Mars, before local atmospheric attenuation |
| Mean length of a Martian solar day | 24.6597 | h | Converts continuous average power to energy per Sol |

These are planetary mean/reference values. The 586.2 W/m² value is not an instantaneous measurement at Gale Crater.

### Crew baseline — NASA BVAD Rev. 2 (2022), Table 3-31

| Quantity | Value per crewmember-day | Unit |
|---|---:|---|
| Oxygen consumed | 0.895 | kg |
| Carbon dioxide generated | 1.085 | kg |
| Food solids consumed (without packaging) | 0.800 | kg dry solids |
| Potable water content | 3.217 | kg |

The simulation converts potable-water mass to litres using the explicit approximation 1 kg water ≈ 1 L. The crew count is four fictional crew members. BVAD values are planning references for life-support analysis, not a complete Mars habitat design.

### Crop reference — NASA BVAD Rev. 2, Table 4-90

| Quantity | Value | Unit |
|---|---:|---|
| Lettuce edible biomass productivity, dry basis | 6.57 | g dry biomass / m² / day |
| Lettuce edible biomass productivity, fresh basis | 131.35 | g fresh biomass / m² / day |
| Fresh-basis water content | 95 | % |
| Nominal crop growth period | 28 | days |

The game starts with a mature crop and uses the dry-biomass productivity as a simplified steady-harvest reference. It does not simulate planting, germination, growth stages, lighting spectra, nutrient solution, crop losses, or harvest scheduling. Greenhouse area, crop condition, crew multiplier, and power availability are scenario inputs.

## Physical and engineering relationships

### Solar array

The model applies a simple direct-beam Beer–Lambert-style attenuation:

`I_surface = I_TOA × exp(-τ)`

`P_peak[kW] = I_surface[W/m²] × array_area[m²] × panel_efficiency × panel_condition / 1000`

`E_solar[kWh/Sol] = P_peak[kW] × equivalent_peak_sun_hours[h/Sol]`

NASA engineering material discusses Mars dust optical depth values around 0.5 for some relatively clear scenarios and larger values during dust storms. The game selects τ = 0.5 for its clear scenario and τ = 3.0 for its storm scenario. These are scenario selections, not measurements from Gale Crater. The equation omits diffuse-sky irradiance, solar zenith/season/latitude geometry, array tilt/tracking, temperature coefficients, dust deposition/cleaning dynamics, and degradation mechanisms.

### Electrical demand and battery

`E_demand[kWh/Sol] = average_load[kW] × 24.6597[h/Sol]`

The server distinguishes power (kW) from stored/consumed energy (kWh). The battery update applies separate charge and discharge efficiency assumptions and clamps the inventory to its capacity. Power-service fraction is a simplified rationing factor when available solar-plus-battery energy is below planned demand.

### Life support

Crew oxygen use, carbon-dioxide production, dry food solids, and potable-water baseline are set from the BVAD values above. Equipment capacities are separate game assumptions. Oxygen production uses a water mass ratio of 18/16 kg H₂O per kg O₂ from the water-electrolysis stoichiometry. The assumed 5 kWh/kg-O₂ electrolyzer energy is covered by the life-support module's assumed average electrical rating; it is not a measured hardware performance figure. CO₂ scrubber capacity and other subsystem ratings are gameplay assumptions.

### Cabin pressure

The pressure delta uses the ideal-gas relation for the net O₂ and CO₂ mole changes in a fixed-volume cabin:

`ΔP = Δn × R × T / V`

The current model holds the other gases constant and assumes a fixed cabin volume. It does not simulate leakage, humidity, full atmospheric composition, pressure-controller behavior, suitlocks, or transient flows. Cabin volume and initial pressure are game assumptions.

### Cabin temperature

A single-node thermal balance applies heater energy minus a simplified conductive heat-loss term. Habitat thermal mass, thermal conductance, and the outside-temperature scenario are all game assumptions. This is not a detailed heat-transfer model of a real habitat.

### Radiation

The visible `radiationRisk` value is an ordinal 0–100 educational/gameplay index. It is **not** an absorbed dose, equivalent dose, mSv, dose rate, or prediction of crew exposure. NASA Curiosity RAD observations are linked as context only; there is no dose conversion or shielding-transport model in this build.

## Explicit game assumptions

The following inputs are deliberately configurable and should not be cited as NASA-measured values: clear/storm optical depth selections, equivalent peak-sun-hours per Sol, array area and PV efficiency, outside temperature, habitat volume and thermal properties, hygiene-loop water throughput and recovery fraction, greenhouse area and water make-up, electrolyzer energy, charge/discharge efficiencies, average equipment loads and capacities, storm/event probability, crew multipliers, event effects, upgrade costs, rover costs, and campaign thresholds.

The game's scenario uses 6.5 equivalent peak-sun-hours per Sol, a 250 m² level-1 array, 22% panel efficiency, and a 150 m³ cabin. These choices are for playability and demonstration; they need sensitivity analysis before being described as an engineering design.

## Known limitations

- No live NASA data feed is connected.
- NASA Mars Trek is cited for future map/terrain work; the current Phaser terrain is original fictional art, Gale-inspired and not to scale.
- NASA DONKI events are not converted into Mars surface dose. Solar-alert incidents are scripted scenarios.
- OSDR and CSA resources are educational/source context only, not machine-readable values used by the numerical simulation.
- No absolute radiation dose, crew medical status, food nutrition balance, closed-loop mass balance, detailed battery electrochemistry, PV spectral response, or hour-by-hour weather is simulated.

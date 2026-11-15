# Data dictionary — Outpost Commander

## Provenance classifications

| Classification | Meaning |
|---|---|
| `NASA_REFERENCE` | Published planetary reference constant from NASA/NSSDC. |
| `NASA_BVAD_REFERENCE` | Nominal crew/crop reference value from NASA BVAD Rev. 2. |
| `NASA_ENGINEERING_REFERENCE` | Engineering scenario range/context from NASA technical material. |
| `DERIVED_WITH_GAME_ASSUMPTIONS` | Formula combines a physical relationship, sourced reference, and explicitly chosen game inputs. |
| `GAME_ASSUMPTION` | Chosen for game behavior; not a measurement or equipment specification. |
| `SOURCE_CONTEXT_ONLY` | Source is linked for future study but contributes no numeric input in the current simulation. |

## API endpoints

| Method / path | Response | Purpose |
|---|---|---|
| `GET /api/v1/data/sources` | `{ sources: [...] }` | Source register, fields, units, classification and limitations. |
| `GET /api/v1/data/physics-constants` | `{ reference, scenario, formulaNotes, equipment }` | Values actually used, scenario assumptions and formulas. |
| `GET /api/v1/data/science-cards` | `{ cards: [...] }` | Short in-game science explanations and citations. |
| `GET /api/v1/data/observations` | `{ observations: [], note }` | Explicitly empty until traceable raw observations are imported. |

## `GameState.environment`

| Field | Unit | Meaning |
|---|---|---|
| `gravityMps2` | m/s² | NASA mean Mars surface gravity; currently contextual telemetry. |
| `solLengthHours` | h | NASA mean Mars solar-day length used in unit conversions. |
| `solarIrradianceTopWm2` | W/m² | NASA mean Mars solar irradiance reference at mean orbital distance; not a local instantaneous reading. |
| `solarIrradianceSurfaceWm2` | W/m² | Simplified model output after dust attenuation. |
| `dustOpticalDepth` | dimensionless | Selected clear/storm scenario input. |
| `equivalentPeakSunHours` | h/Sol | Game assumption folding illumination geometry into one daily factor. |
| `outsideTemperatureC` | °C | Scenario boundary condition, not live weather. |
| `dustStorm` | boolean | Deterministic scenario flag for the current Sol. |
| `solarArrayAreaM2` | m² | Assumed level-dependent installed array area. |
| `solarPeakPowerKw` | kW | Derived array peak power after condition and attenuation. |
| `solarEnergyKwh` | kWh/Sol | Derived daily energy using equivalent peak-sun hours. |
| `energyDemandKwh` | kWh/Sol | Average assumed continuous load × Sol length. |

## Resource fields and units

| Field | Unit | Interpretation |
|---|---|---|
| `oxygenKg` | kg O₂ | Stored oxygen mass. |
| `carbonDioxideKg` | kg CO₂ | Stored cabin CO₂ inventory (simplified). |
| `cabinPressureKpa` | kPa | Ideal-gas O₂/CO₂ balance indicator in fixed volume. |
| `waterLiters` | L | Potable/water-loop inventory; 1 kg water ≈ 1 L approximation. |
| `foodKg` | kg dry solids | Food inventory using BVAD dry-food-solids baseline. |
| `batteryKwh` | kWh | Stored electrical energy, bounded by capacity. |
| `powerBalanceKw` | kW | Net daily energy balance divided by Sol duration (average-equivalent power). |
| `radiationRisk` | score 0–100 | Ordinal gameplay indicator only; not dose, mSv, or a radiation measurement. |
| `temperatureC` | °C | Simplified cabin thermal state from the one-node model. |

## Units policy

Always keep kW (power) separate from kWh (energy). Every energy calculation spanning a Sol uses the 24.6597-hour Sol constant. Crew metabolism is per crewmember per day and is applied once per Sol as a nominal approximation. NASA reference fields must never be represented as a live observation or as local Gale measurement unless location/time-resolved data are actually ingested.

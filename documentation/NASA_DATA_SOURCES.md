# NASA / CSA source register

This file distinguishes values used in the current calculation from resources cited for future work. A linked page is not automatically a dataset ingested by the game.

| Source | URL | Values used now | Classification / limitation |
|---|---|---|---|
| NASA/NSSDC Mars Fact Sheet | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html | 3.73 m/s² mean surface gravity; 586.2 W/m² mean solar irradiance at Mars' mean orbital distance; 24.6597 h mean Sol | Planetary reference, not Gale instantaneous weather |
| NASA BVAD Rev. 2 (2022) | https://ntrs.nasa.gov/citations/20210024855 | O₂ 0.895 kg/crew-day; CO₂ 1.085 kg/crew-day; dry food solids 0.800 kg/crew-day; potable water 3.217 kg/crew-day | Nominal reference values, not a complete Mars habitat design |
| NASA BVAD Rev. 2 PDF, Table 4-90 | https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf | Lettuce edible dry biomass 6.57 g/m²·day; fresh basis 131.35 g/m²·day; 95% water; nominal 28-day growth period | Model uses mature-crop daily dry biomass approximation |
| NASA Mars solar-power technical context | https://science.nasa.gov/wp-content/uploads/2023/09/D-20757.pdf | Optical-depth context for Mars solar-power scenarios; clear/quiescent conditions around τ=0.5 and occasional dust storms around τ=2–4 | Model selects τ=0.5 and τ=3.0 as game scenarios; not measured Gale weather |
| NASA Curiosity RAD / JPL context | https://www.jpl.nasa.gov/images/pia16479-daily-cycles-of-radiation-and-pressure-at-gale-crater/ | Context only | Plot's radiation units were described as arbitrary while absolute calibration was ongoing; not used as dose values |
| NASA Mars Trek | https://trek.nasa.gov/mars/ | No terrain rasters or map tiles currently ingested | Future terrain/elevation integration reference |
| NASA DONKI | https://ccmc.gsfc.nasa.gov/tools/DONKI/ | No feed currently ingested | Heliophysics event context only; not translated into Mars surface dose |
| NASA Open Science Data Repository | https://osdr.nasa.gov/ | No experiment dataset currently ingested | Space-biology research context only |
| Canadian Space Agency — Food production on the Moon | https://www.asc-csa.gc.ca/eng/astronomy/moon/food-production-on-the-moon-and-in-remote-areas/ | No numeric dataset currently ingested | Educational/engineering context only |

## API behavior

- `GET /api/v1/data/sources` lists the source register and each source's limitations.
- `GET /api/v1/data/physics-constants` exposes the used scientific references, scenario assumptions and formula notes.
- `GET /api/v1/data/science-cards` returns the in-game learning cards.
- `GET /api/v1/data/observations` intentionally returns an empty `observations` array until real, traceable time-series observations are actually imported. It does not return fabricated measurements.

## Provenance rule

Every new numeric input must have a source, units, date/version, location/planetary context, and classification. If a value is selected for balance rather than taken from a source, label it `GAME_ASSUMPTION`. Never describe the planetary mean irradiance as a Gale surface reading, ISS RAD data as a Mars surface dose, or a DONKI event as a direct surface exposure prediction.

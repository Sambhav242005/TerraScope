# Renewable-energy environmental-effects research

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Scope correction

The complete solar/wind brief remains part of the requested environmental-planning product, with placement in the same view as flood/storage scenarios. It must not be silently deferred out of the product. Research and model integration are staged, with unsupported effects explicit. See docs/REQUIREMENTS.md R06–R09. The earlier “separate track” and “later tools” language below describes execution separation, not cancellation.


Separate research track; not an implemented model or completed literature review. The full user-provided brief is preserved in [renewables-question.md](research/renewables-question.md). Treat its quoted numerical claims as questions to verify, not established results or instructions to assume a mechanism.

## Question

How do solar and wind installations change energy/momentum flows, and which local, regional or hypothetical planetary effects are supported by evidence? Compare equivalent fossil-generation alternatives and distinguish local physical effects from greenhouse-gas-driven climate change.

## Work plan

1. Build a primary-literature register: authors/title/year/DOI, location/domain, method, deployment scale, measurement height/time, quantitative result, assumptions, limits and replication status.
2. Classify claims as field/experimental observation, numerical simulation, plausible but untested, or unsupported. Explain conflicting findings rather than selecting only favorable studies.
3. Distinguish panel, ground and air temperatures; day/night; albedo, shading, evaporation, roughness and electrical export. Specify control volume and sign conventions in an energy budget such as Rn = H + LE + G + storage + electrical export, with consistent terms and no double counting. Exported electricity is not energy destroyed.
4. Treat turbine power P = 0.5 rho A v³ Cp as a local extraction relationship, with assumptions. Investigate momentum, wakes, replenishment and mixing; this equation alone cannot predict regional rainfall.
5. Compare rooftop/individual, utility, regional, continental and hypothetical planetary scenarios. Do not linearly extrapolate local effects or confuse hypothetical Sahara coverage with actual deployment.
6. Design reproducible illustrative energy/wake experiments, then assess whether WRF/land-surface/large-eddy or other specialist models are appropriate. Tool/model selection, compute and expert review are pending, not commitments.
7. Report uncertainties, evidence strength, net climate trade-offs, data/code provenance and open research questions.

## Specific claims requiring original-paper verification

- The brief's reported2025 PV-array wind reduction of30–40%: identify the actual paper, domain, measurement locations and method before quoting.
- The reported2019 desert solar-farm maximum air-temperature difference of about1.3°C at approximately1.5m: locate the original publication and conditions.
- Hypothetical Sahara scenarios covering approximately20%: establish deployment assumptions, coupling/feedbacks and model-dependent remote effects.
- Do not claim turbines/trees trap clouds or solar installations universally cool their surroundings.

## Starting references, not a completed evidence matrix

- [DOE AWAKEN](https://www.energy.gov/sites/default/files/2022-01/AWAKEN-fact-sheet.pdf): turbine wakes and field-research context.
- [NOAA cloud formation](https://www.noaa.gov/jetstream/clouds/how-clouds-form): physical requirements for cloud formation.
- [FAO forests and water](https://www.fao.org/sustainable-forest-management-toolbox/modules/forest-and-water): context-dependent hydrological effects and limits.
- [AlphaEarth](https://deepmind.google/blog/alphaearth-foundations-helps-map-our-planet-in-unprecedented-detail/): observational representations, not an open physical Earth clone.

## Product boundary

Do not use unverified research coefficients in flood warnings. Later renewable tools may compare siting/yield or supported local impacts, but each needs its own validation. Keep research experiments labeled and separate from the first flood-preparedness demonstration.

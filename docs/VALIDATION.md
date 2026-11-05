# Validation and responsible claims

> Current status (5 November 2026): [Latest delivery, verification and remaining gaps](CURRENT_STATUS.md) supersedes older implementation-status statements below. Earlier dated notes are retained as history. R01-R18 remain active.


## Three experiments, three different claims

1. Reconstruction with realized rainfall: can the model reproduce important aspects of the observed event?
2. Retrospective forecast with archived issue-time inputs: could it have provided useful warning before the event?
3. Counterfactual scenario: what does this model estimate under explicit changed assumptions? This is not an observed outcome or proof that an intervention would work.

## Freeze protocol before fitting

Record pilot bounds, event interval, warning cutoff and horizon, data available by the cutoff, publication latency, calibration/test periods, independent observations, metrics, baselines and threshold-selection procedure. Later reanalysis corrections, final satellite products, annual summaries incorporating the event and post-event maps cannot leak into a claimed advance forecast.

Use held-out events and non-event periods. Avoid spatial leakage where nearby pixels from the same event appear in both training and testing. If sufficient independent cases are unavailable, report a case study rather than broad predictive accuracy. Retain missing/out-of-coverage periods in the coverage report.

## Baselines and metrics

Compare a simple rainfall/river-level threshold, persistence where meaningful, official forecasts/warnings where archived, and a warn-everywhere reference. Match available information and warning horizons fairly.

Report event recall, precision, missed severe events, false alerts per location/time period, warning duration and useful lead time. For suitable outputs report flow/stage errors and timing, flood-extent overlap and depth errors against independent measurements. Evaluate probability calibration only when outputs are probabilities; ensemble spread alone is not calibrated confidence. Document reference-data uncertainty and incomplete impact reporting.

## False-positive versus false-negative preference

The user prioritizes avoiding missed severe hazards. Implement action-specific trade-off analysis, not a fixed unreviewed penalty. A low-cost watch can tolerate more false alerts than a disruptive protective action. Plot threshold outcomes and costs/exposure, obtain expert review and retain the rationale. No operational alert threshold is approved yet. Never describe a warning-everywhere model as successful solely because recall is high.

## Engineering verification

Check units, CRS, datum, timezones, missing masks and raster alignment. Use known analytical/synthetic cases for numerical checks and conservation where applicable. Record solver convergence and failure; never substitute a plausible animation for a failed run. Confirm deterministic/reproducible outputs within documented numerical tolerances and identical inputs across comparisons.

## Field and AI evaluation

Field observations need location, timestamp, measurement method, uncertainty and reviewer history. Test conflicting/stale evidence and reruns. Human confirmation of a local observation does not validate the entire flood model.

AI evaluation includes citation support, unsupported numbers, contradictory guidance, stale sources, missing capacities, prompt injection in documents and unsafe certainty. Reject invented route safety or structure certification. Drafts cannot automatically issue warnings; urgent official instructions remain independent of this prototype.

## UI and device evaluation

Test the full journey, saved state, failure recovery, keyboard, touch,360px, reduced motion, paused animation and non-WebGL access. Review recorded sequences for temporal glitches. Measure on an identified physical phone and desktop with dataset/network/browser details. Desktop viewport emulation is only layout evidence. Prior wildlife tests and screenshots are historical, not validation of the new product.

## Release claims

Publish a reproducible evaluation report and known limits. A historical reconstruction or small retrospective study is not a certified warning service. Missing inputs must reduce scope/confidence rather than imply safety. Expert collaboration and substantially broader validation are required before government operational use.

## Current software checks versus scientific validation

The 4 November 2026 prototype has six flood-specific unit tests (reservoir conservation/determinism, invalid input rejection, linear response, geographic distance and checklist claims) and browser workflow tests. These establish software behavior only. No hydrological calibration, independent event/non-event validation, forecast lead-time measurement or false-alarm/missed-event assessment has been completed. Physical-phone performance is also unmeasured. Do not replace the evaluation protocol above with screenshot or unit-test results. See docs/DELIVERY.md.

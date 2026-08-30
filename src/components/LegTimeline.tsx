import type { TripPlan } from '../types';
import { assessRisk, describeWeatherCode, riskColour } from '../logic/risk';
import { formatDeparture } from '../hooks/useTripPlanner';

interface Props {
  plan: TripPlan;
  departureMs: number;
}

/** Per-waypoint conditions timeline. */
export function LegTimeline({ plan, departureMs }: Props) {
  return (
    <section className="timeline" aria-label="Conditions per leg">
      <h2>Conditions along the route</h2>
      <p className="hint">Departure {formatDeparture(departureMs)}</p>
      <ol>
        {plan.weather.map((w) => {
          const risk = assessRisk(w);
          const eta = new Date(w.waypoint.etaMs).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <li key={w.waypoint.index} data-risk={risk.level}>
              <span className="dot" style={{ background: riskColour(risk.level) }} />
              <div>
                <strong>Waypoint {w.waypoint.index + 1}</strong>{' '}
                <span className="hint">· ETA {eta}</span>
                <p>
                  {describeWeatherCode(w.weatherCode)} · {w.temperatureC.toFixed(1)} °C · wind{' '}
                  {Math.round(w.windSpeedMph)} mph · gusts{' '}
                  <strong>{Math.round(w.windGustMph)} mph</strong> · rain{' '}
                  {w.precipitationMm.toFixed(1)} mm
                </p>
                {risk.reasons.length > 0 && (
                  <ul className="reasons">
                    {risk.reasons.map((r) => (
                      <li key={r}>⚠ {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

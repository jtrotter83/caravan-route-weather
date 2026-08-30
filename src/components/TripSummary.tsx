import type { TripPlan } from '../types';
import { assessTripRisk, riskColour } from '../logic/risk';
import { formatDuration, formatKm } from '../hooks/useTripPlanner';

interface Props {
  plan: TripPlan;
  departureMs: number;
}

/** Overall trip summary + towing risk verdict. */
export function TripSummary({ plan, departureMs }: Props) {
  const risk = assessTripRisk(plan.weather);
  const arrival = new Date(departureMs + plan.route.durationSeconds * 1000);
  const worstGust = Math.max(...plan.weather.map((w) => w.windGustMph));

  const verdict =
    risk.level === 'danger'
      ? 'High risk — consider delaying or taking an alternative route'
      : risk.level === 'caution'
        ? 'Caution — check conditions before setting off'
        : 'Good conditions for towing';

  return (
    <section className="summary" aria-label="Trip summary">
      <h2>
        <span className="dot" style={{ background: riskColour(risk.level) }} />
        {verdict}
      </h2>
      <p>
        {formatKm(plan.route.distanceMetres)} · {formatDuration(plan.route.durationSeconds)} ·
        arrive ~{arrival.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p>
        Max gusts along route: <strong>{Math.round(worstGust)} mph</strong>
        {worstGust > 35 && ' — exceeds 35 mph towing threshold'}
      </p>
      {risk.reasons.length > 0 && (
        <details>
          <summary>Warnings</summary>
          <ul>
            {risk.reasons.map((r) => (
              <li key={r}>⚠ {r}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

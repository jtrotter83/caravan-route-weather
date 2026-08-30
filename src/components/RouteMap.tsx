import { CircleMarker, MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import type { Place, TripPlan } from '../types';
import { assessRisk, riskColour } from '../logic/risk';

interface Props {
  plan: TripPlan | null;
  start: Place | null;
  destination: Place | null;
}

export function RouteMap({ plan, start, destination }: Props) {
  const centre: [number, number] = start ? [start.lat, start.lng] : [54.5, -2.5]; // UK centroid fallback

  return (
    <MapContainer center={centre} zoom={6} className="map" data-testid="map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {start && <Marker position={[start.lat, start.lng]} title="Start" />}
      {destination && <Marker position={[destination.lat, destination.lng]} title="Destination" />}
      {plan && (
        <>
          <Polyline
            positions={plan.route.geometry.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#1e88e5', weight: 4 }}
          />
          {plan.weather.map((w) => {
            const risk = assessRisk(w);
            return (
              <CircleMarker
                key={w.waypoint.index}
                center={[w.waypoint.position.lat, w.waypoint.position.lng]}
                radius={8}
                pathOptions={{ color: riskColour(risk.level), fillOpacity: 0.9 }}
              />
            );
          })}
        </>
      )}
    </MapContainer>
  );
}

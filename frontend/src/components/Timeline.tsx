import type { RouteInstruction, ScheduleStop } from '../types';

interface TimelineProps {
  instructions: RouteInstruction[];
  stops: ScheduleStop[];
}

export function Timeline({ instructions, stops }: TimelineProps) {
  return (
    <section className="timeline-grid" aria-label="Route timeline">
      <div className="planner-card timeline-card">
        <div className="card-header">
          <p className="section-kicker">Turn-by-turn</p>
          <h2>Route instructions</h2>
        </div>

        {instructions.length ? (
          <ol className="instruction-list">
            {instructions.map((instruction, index) => (
              <li key={`${instruction.text}-${index}`}>
                <span className="instruction-index">{index + 1}</span>
                <div>
                  <strong>{instruction.text}</strong>
                  <span>{formatNumber(instruction.distance_miles)} mi · {formatMinutes(instruction.duration_minutes)}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-note">No route instructions were returned for this route.</p>
        )}
      </div>

      <div className="planner-card timeline-card">
        <div className="card-header">
          <p className="section-kicker">Schedule</p>
          <h2>Stops and rests</h2>
        </div>

        {stops.length ? (
          <ol className="stop-list">
            {stops.map((stop, index) => {
              const label = getStopLabel(stop);
              const isRestStop = label === 'Rest' || label === 'Restart';

              return (
                <li className={isRestStop ? 'stop-item stop-item-rest' : 'stop-item'} key={`${stop.type}-${stop.hour}-${index}`}>
                  <span className="stop-pin" aria-hidden="true" />
                  <div>
                    <div className="stop-meta">
                      <span className={isRestStop ? 'status-pill status-pill-amber' : 'status-pill status-pill-cyan'}>{label}</span>
                      <span>{formatHourOffset(stop.hour)}</span>
                    </div>
                    <strong>{stop.location}</strong>
                    <span>{formatHours(stop.duration_hours)} scheduled</span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty-note">No scheduled stops were returned for this route.</p>
        )}
      </div>
    </section>
  );
}

function getStopLabel(stop: ScheduleStop): string {
  if (stop.type === 'pickup') {
    return 'Pickup';
  }
  if (stop.type === 'dropoff') {
    return 'Dropoff';
  }
  if (stop.type === 'fuel') {
    return 'Fuel';
  }
  if (stop.type === 'restart' || stop.location.toLowerCase().includes('34-hour restart')) {
    return 'Restart';
  }
  return 'Rest';
}

function formatHourOffset(hour: number): string {
  const day = Math.floor(hour / 24) + 1;
  const hourWithinDay = hour % 24;
  const wholeHours = Math.floor(hourWithinDay);
  const minutes = Math.round((hourWithinDay - wholeHours) * 60);
  const displayHours = minutes === 60 ? wholeHours + 1 : wholeHours;
  const displayMinutes = minutes === 60 ? 0 : minutes;

  return `Day ${day}, ${displayHours.toString().padStart(2, '0')}:${displayMinutes.toString().padStart(2, '0')}`;
}

function formatHours(value: number): string {
  return `${formatNumber(value)} hr`;
}

function formatMinutes(value: number): string {
  if (value >= 60) {
    return formatHours(value / 60);
  }

  return `${formatNumber(value)} min`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

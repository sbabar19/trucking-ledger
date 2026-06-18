import type { DutyStatus, LogDay, LogSegment, ScheduleStop } from "@/types";

interface LogSheetProps {
  day: LogDay;
  stops?: ScheduleStop[];
}

const graphLeft = 96;
const graphRight = 1072;
const graphTop = 48;
const rowHeight = 58;
const rowCenters: Record<DutyStatus, number> = {
  off_duty: graphTop + rowHeight * 0.5,
  sleeper_berth: graphTop + rowHeight * 1.5,
  driving: graphTop + rowHeight * 2.5,
  on_duty: graphTop + rowHeight * 3.5,
};

const dutyRows: Array<{ status: DutyStatus; label: string }> = [
  { status: "off_duty", label: "Off Duty" },
  { status: "sleeper_berth", label: "Sleeper Berth" },
  { status: "driving", label: "Driving" },
  { status: "on_duty", label: "On Duty (Not Driving)" },
];

const statusColors: Record<DutyStatus, string> = {
  off_duty: "oklch(0.47 0.035 255)",
  sleeper_berth: "oklch(0.56 0.13 292)",
  driving: "oklch(0.53 0.13 210)",
  on_duty: "oklch(0.62 0.14 62)",
};

export function LogSheet({ day, stops = [] }: LogSheetProps) {
  const drawableSegments = day.segments.filter(
    (segment) => segment.end > segment.start,
  );
  const dayStops = stops.filter(
    (stop) => stop.hour >= (day.day - 1) * 24 && stop.hour < day.day * 24,
  );
  const remarks = getRemarks(day.segments, dayStops);
  const totalHours = Object.values(day.totals).reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <article className="log-sheet">
      <header className="log-sheet-header">
        <div>
          <p className="section-kicker">Driver daily log</p>
          <h3>{day.label}</h3>
        </div>
        <dl>
          <div>
            <dt>Total miles</dt>
            <dd>
              {day.total_miles === undefined
                ? "Not provided"
                : formatNumber(day.total_miles)}
            </dd>
          </div>
          <div>
            <dt>Carrier</dt>
            <dd>Trucking Ledger Dispatch</dd>
          </div>
          <div>
            <dt>Truck</dt>
            <dd>Unit TBD</dd>
          </div>
          <div>
            <dt>Total hours</dt>
            <dd>{formatHours(totalHours)}</dd>
          </div>
        </dl>
      </header>

      <svg
        className="log-graph"
        viewBox="0 0 1120 330"
        role="img"
        aria-label={`${day.label} duty status graph`}
      >
        <rect
          x="0"
          y="0"
          width="1120"
          height="330"
          rx="18"
          fill="oklch(0.99 0.004 255)"
        />
        {dutyRows.map((row, index) => {
          const rowTop = graphTop + index * rowHeight;
          return (
            <g key={row.status}>
              <rect
                x={graphLeft}
                y={rowTop}
                width={graphRight - graphLeft}
                height={rowHeight}
                fill={
                  index % 2 === 0
                    ? "oklch(0.97 0.01 255)"
                    : "oklch(0.995 0.003 255)"
                }
              />
              <text
                x="22"
                y={rowCenters[row.status] + 5}
                className="log-row-label"
              >
                {row.label}
              </text>
            </g>
          );
        })}
        {Array.from({ length: 25 }, (_, hour) => {
          const x = xForHour(hour);
          const isMajor = hour % 6 === 0;
          return (
            <g key={hour}>
              <line
                x1={x}
                x2={x}
                y1={graphTop - 24}
                y2={graphTop + rowHeight * 4}
                stroke={
                  isMajor ? "oklch(0.7 0.025 255)" : "oklch(0.9 0.012 255)"
                }
                strokeWidth={isMajor ? 1.4 : 0.8}
              />
              <text
                x={x}
                y={graphTop - 30}
                textAnchor="middle"
                className="log-hour-label"
              >
                {hour}
              </text>
            </g>
          );
        })}

        {dutyRows.map((row, index) => {
          const rowTop = graphTop + index * rowHeight;
          return (
            <g key={row.status}>
              <line
                x1={graphLeft}
                x2={graphRight}
                y1={rowTop}
                y2={rowTop}
                stroke="oklch(0.84 0.018 255)"
              />
            </g>
          );
        })}
        <line
          x1={graphLeft}
          x2={graphRight}
          y1={graphTop + rowHeight * 4}
          y2={graphTop + rowHeight * 4}
          stroke="oklch(0.84 0.018 255)"
        />

        {drawableSegments.map((segment, index) => (
          <g key={`${segment.status}-${segment.start}-${segment.end}-${index}`}>
            {index > 0 &&
            drawableSegments[index - 1].status !== segment.status ? (
              <line
                x1={xForHour(segment.start)}
                x2={xForHour(segment.start)}
                y1={rowCenters[drawableSegments[index - 1].status]}
                y2={rowCenters[segment.status]}
                stroke="oklch(0.27 0.045 255)"
                strokeWidth="3"
              />
            ) : null}
            <line
              x1={xForHour(segment.start)}
              x2={xForHour(segment.end)}
              y1={rowCenters[segment.status]}
              y2={rowCenters[segment.status]}
              stroke={statusColors[segment.status]}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        ))}

        <text x={graphLeft} y="308" className="log-total-label">
          Daily totals
        </text>
        {dutyRows.map((row, index) => (
          <text
            key={row.status}
            x={graphLeft + 150 + index * 210}
            y="308"
            className="log-total-value"
          >
            {row.label}: {formatHours(day.totals[row.status])}
          </text>
        ))}
      </svg>

      <div className="log-remarks">
        <h4>Remarks</h4>
        {remarks.length ? (
          <ul>
            {remarks.map((remark) => (
              <li key={remark}>{remark}</li>
            ))}
          </ul>
        ) : (
          <p>No remarks returned for this log day.</p>
        )}
      </div>
    </article>
  );
}

function getRemarks(segments: LogSegment[], stops: ScheduleStop[]): string[] {
  const segmentRemarks = segments
    .map((segment) => segment.remarks)
    .filter((remark) => remark && remark.toLowerCase() !== "off duty");
  const stopRemarks = stops.map(
    (stop) => `${formatStopLabel(stop)} at ${stop.location}`,
  );

  return Array.from(new Set([...segmentRemarks, ...stopRemarks]));
}

function formatStopLabel(stop: ScheduleStop): string {
  if (stop.type === "pickup") {
    return "Pickup";
  }
  if (stop.type === "dropoff") {
    return "Dropoff";
  }
  if (stop.type === "fuel") {
    return "Fuel";
  }
  if (
    stop.type === "restart" ||
    stop.location.toLowerCase().includes("34-hour restart")
  ) {
    return "Restart";
  }
  return "Rest";
}

function xForHour(hour: number): number {
  return (
    graphLeft +
    (Math.min(Math.max(hour, 0), 24) / 24) * (graphRight - graphLeft)
  );
}

function formatHours(value: number): string {
  return `${formatNumber(value)} hr`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

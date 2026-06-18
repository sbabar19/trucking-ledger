import type { DutyStatus, LogDay, LogSegment } from "@/types";

interface LogSheetProps {
  day: LogDay;
}

interface PaperFieldProps {
  label: string;
  value?: string;
  className?: string;
}

const graphLeft = 150;
const graphRight = 990;
const totalsLeft = 1026;
const labelTop = 22;
const graphTop = 48;
const rowHeight = 36;
const graphBottom = graphTop + rowHeight * 4;
const remarksAxisY = graphBottom + 28;
const remarksStemTop = remarksAxisY + 24;
const remarksStemBottom = remarksStemTop + 36;
const remarksTextY = remarksAxisY + 140;
const svgHeight = remarksTextY + 86;
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

const graphTicks = Array.from({ length: 97 }, (_, index) => index / 4);
const hourLabels = Array.from({ length: 25 }, (_, hour) => hour);
const remarksHourLabels = Array.from({ length: 24 }, (_, hour) => hour);
const nonHourTicks = graphTicks.filter((tick) => tick % 1 !== 0);
const labeledHours = hourLabels.filter((hour) => hour === 0 || hour === 12 || (hour >= 2 && hour <= 23));

export function LogSheet({ day }: LogSheetProps) {
  const drawableSegments = day.segments.filter(
    (segment) => segment.end > segment.start,
  );
  const remarkEntries = getRemarkEntries(day.segments);
  const totalHours = Object.values(day.totals).reduce(
    (sum, value) => sum + value,
    0,
  );

  return (
    <article className="log-sheet" aria-label={`${day.label} driver's daily log`}>
      <header className="paper-log-title">
        <div className="paper-log-agency">
          U.S. DEPARTMENT OF TRANSPORTATION
        </div>
        <div className="paper-log-heading">
          <h3>DRIVER'S DAILY LOG</h3>
          <p>(ONE CALENDAR DAY - 24 HOURS)</p>
        </div>
        <div className="paper-log-copy-notes">
          <span>ORIGINAL - Submit to carrier within 13 days</span>
          <span>DUPLICATE - Driver retains possession for eight days</span>
        </div>
      </header>

      <section className="paper-log-fields" aria-label="Driver log metadata">
        <div className="paper-log-date-group" aria-label="Calendar date">
          <span>Date</span>
          <PaperField label="Month" className="paper-log-date-field" />
          <PaperField label="Day" className="paper-log-date-field" />
          <PaperField label="Year" className="paper-log-date-field" />
        </div>
        <PaperField label="Log day" value={day.label} />
        <PaperField
          label="Total miles driving today"
          value={formatNumber(day.total_miles)}
        />
        <PaperField label="Truck or tractor and trailer numbers" />
        <PaperField label="Name of carrier" />
        <PaperField label="Main office address" className="paper-log-field--wide" />
        <div className="paper-log-signature-block">
          <p>I certify that these entries are true and correct</p>
          <PaperField label="Driver's signature" />
        </div>
        <PaperField label="Co-driver" />
        <PaperField
          label="Shipping documents / shipper / commodity"
          className="paper-log-field--wide"
        />
      </section>

      <section className="paper-log-graph-wrap" aria-label="Duty status graph">
        <svg
          className="log-graph"
          viewBox={`0 0 1080 ${svgHeight}`}
          role="img"
          aria-label={`${day.label} 24-hour duty status graph`}
        >
          <rect x="0" y="0" width="1080" height={svgHeight} fill="#ffffff" />
          {labeledHours.map((hour) => (
            <text
              key={hour}
              x={xForHour(hour)}
              y={labelTop}
              textAnchor={hour === 0 ? "start" : "middle"}
              className="log-hour-label"
            >
              {hour === 0 ? "Midnight" : hour === 12 ? "Noon" : hour}
            </text>
          ))}
          <text x={totalsLeft} y={labelTop - 7} className="log-total-heading">
            Total
          </text>
          <text x={totalsLeft} y={labelTop + 6} className="log-total-heading">
            Hours
          </text>

          {dutyRows.map((row, index) => (
            <g key={row.status}>
              <text
                x="18"
                y={rowCenters[row.status] - 5}
                className="log-row-number"
              >
                {index + 1}.
              </text>
              <text
                x="38"
                y={rowCenters[row.status] - 5}
                className="log-row-label"
              >
                {row.label.split(" (")[0]}
              </text>
              {row.status === "on_duty" ? (
                <text x="38" y={rowCenters[row.status] + 9} className="log-row-label-small">
                  (Not Driving)
                </text>
              ) : null}
            </g>
          ))}

          <rect
            x={graphLeft}
            y={graphTop}
            width={graphRight - graphLeft}
            height={graphBottom - graphTop}
            fill="none"
            stroke="#111827"
            strokeWidth="1.5"
          />

          {graphTicks.map((tick) => {
            const tickIndex = Math.round(tick * 4);
            const isHour = tickIndex % 4 === 0;
            if (!isHour) {
              return null;
            }
            return (
              <line
                key={tick}
                x1={xForHour(tick)}
                x2={xForHour(tick)}
                y1={graphTop}
                y2={graphBottom}
                className="log-grid-hour"
                strokeWidth="1"
              />
            );
          })}

          {nonHourTicks.flatMap((tick) => {
            const tickIndex = Math.round(tick * 4);
            const isHalfHour = tickIndex % 2 === 0;
            const tickLength = isHalfHour ? 18 : 10;
            return dutyRows.map((row, rowIndex) => {
              const rowTop = graphTop + rowIndex * rowHeight;
              return (
                <line
                  key={`${tick}-${row.status}`}
                  x1={xForHour(tick)}
                  x2={xForHour(tick)}
                  y1={rowTop}
                  y2={rowTop + tickLength}
                  className={isHalfHour ? "log-grid-half" : "log-grid-quarter"}
                />
              );
            });
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
                  className="log-grid-row"
                />
                <text
                  x={totalsLeft}
                  y={rowCenters[row.status] + 4}
                  className="log-total-value"
                >
                  {formatHours(day.totals[row.status])}
                </text>
              </g>
            );
          })}
          <line
            x1={graphLeft}
            x2={graphRight}
            y1={graphBottom}
            y2={graphBottom}
            className="log-grid-row"
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
                  className="log-duty-line"
                />
              ) : null}
              <line
                x1={xForHour(segment.start)}
                x2={xForHour(segment.end)}
                y1={rowCenters[segment.status]}
                y2={rowCenters[segment.status]}
                className="log-duty-line"
              />
            </g>
          ))}

          <text x="18" y={remarksAxisY + 58} className="log-remarks-heading">
            REMARKS
          </text>
          <text x={totalsLeft} y={remarksAxisY + 8} className="log-total-heading-dark">
            =24
          </text>

          {remarksHourLabels.map((hour) => (
            <text
              key={`remark-hour-${hour}`}
              x={xForHour(hour)}
              y={remarksAxisY - 8}
              textAnchor={hour === 0 ? "start" : "middle"}
              className="log-remark-hour"
            >
              {formatRemarksHour(hour)}
            </text>
          ))}
          <line
            x1={graphLeft}
            x2={graphRight}
            y1={remarksAxisY}
            y2={remarksAxisY}
            className="log-remark-axis"
          />
          {graphTicks.map((tick) => {
            const tickIndex = Math.round(tick * 4);
            const isHour = tickIndex % 4 === 0;
            const isHalfHour = tickIndex % 2 === 0;
            const tickLength = isHour ? 22 : isHalfHour ? 15 : 10;
            return (
              <line
                key={`remark-tick-${tick}`}
                x1={xForHour(tick)}
                x2={xForHour(tick)}
                y1={remarksAxisY}
                y2={remarksAxisY + tickLength}
                className="log-remark-tick"
              />
            );
          })}

          {remarkEntries.slice(0, 12).map((entry, index) => {
            const startX = xForHour(entry.start);
            const endX = xForHour(entry.end);
            const markerX = remarkMarkerX(entry.start, index);
            const markerY = remarksTextY + (index % 3) * 20;
            const locationX = markerX - 8;
            const locationY = markerY - 30;
            const purposeX = markerX + 8;
            const purposeY = markerY + 16;
            return (
              <g key={`${entry.start}-${entry.location}-${entry.purpose}-${index}`}>
                <path
                  d={entry.isShortEvent
                    ? `M ${startX} ${remarksStemTop} V ${remarksStemBottom} H ${endX} V ${remarksStemTop} M ${startX} ${remarksStemBottom} L ${markerX} ${markerY}`
                    : `M ${startX} ${remarksStemTop} V ${remarksStemBottom} L ${markerX} ${markerY}`}
                  className="log-remark-leader"
                />
                <text
                  x={locationX}
                  y={locationY}
                  transform={`rotate(-48 ${locationX} ${locationY})`}
                  className="log-remark-location"
                >
                  {entry.location}
                </text>
                {entry.purpose ? (
                  <text
                    x={purposeX}
                    y={purposeY}
                    transform={`rotate(-48 ${purposeX} ${purposeY})`}
                    className="log-remark-purpose"
                  >
                    {entry.purpose}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </section>

      <section className="paper-log-lower" aria-label="Remarks and shipping">
        <div className="paper-log-shipping-row">
          <PaperField label="Pro or Shipping No." />
          <span className="paper-log-total-marker">=24</span>
        </div>
      </section>

      <footer className="paper-log-recap" aria-label="Cycle recap">
        <PaperField label="Total hours" value={formatHours(totalHours)} />
        <PaperField
          label="Cycle used at start"
          value={formatHours(day.recap.cycle_used_start)}
        />
        <PaperField
          label="Cycle used at end"
          value={formatHours(day.recap.cycle_used_end)}
        />
        <PaperField
          label="Cycle available at end"
          value={formatHours(day.recap.cycle_available_end)}
        />
      </footer>
    </article>
  );
}

function PaperField({ label, value, className = "" }: PaperFieldProps) {
  return (
    <dl className={`paper-log-field${className ? ` ${className}` : ""}`}>
      <dd>{value}</dd>
      <dt>{label}</dt>
    </dl>
  );
}

function getRemarkEntries(segments: LogSegment[]) {
  return segments
    .filter(
      (segment, index) =>
        segment.start > 0 &&
        (index === 0 || segment.status !== segments[index - 1].status),
    )
    .map((segment) => {
      const detail = formatRemarkDetail(segment.remarks);
      return {
        start: segment.start,
        end: segment.end,
        location: segment.location,
        purpose: detail,
        isShortEvent: segment.end - segment.start >= 0.5 && segment.end - segment.start <= 1,
      };
    });
}

function formatRemarkDetail(remark: string): string {
  const normalizedRemark = remark.trim().toLowerCase();
  if (!normalizedRemark || normalizedRemark === "off duty" || normalizedRemark.startsWith("drive toward")) {
    return "";
  }
  if (normalizedRemark === "required 30-minute break") {
    return "30 min break";
  }
  if (normalizedRemark === "required 10-hour break") {
    return "10 hour break";
  }
  if (normalizedRemark === "required 34-hour restart") {
    return "34 hour restart";
  }
  return remark;
}

function xForHour(hour: number): number {
  return (
    graphLeft +
    (Math.min(Math.max(hour, 0), 24) / 24) * (graphRight - graphLeft)
  );
}

function remarkMarkerX(hour: number, index: number): number {
  const stagger = index % 2 === 0 ? -20 : 28;
  return Math.min(Math.max(xForHour(hour) - 98 + stagger, graphLeft + 72), graphRight - 132);
}

function formatRemarksHour(hour: number): string {
  if (hour === 0) {
    return "Midnight";
  }
  if (hour === 12) {
    return "noon";
  }
  return String(hour > 12 ? hour - 12 : hour);
}

function formatHours(value: number): string {
  return `${formatNumber(value)} hr`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

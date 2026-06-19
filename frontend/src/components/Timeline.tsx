import { ComplianceSummary } from "@/components/planner/ComplianceSummary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { formatHourOffset, formatHours } from "@/lib/format";
import { getStopLabel } from "@/lib/schedule";
import type { ScheduleStop, TripPlanResponse } from "@/types";

interface TimelineProps {
  result: TripPlanResponse;
  isLoading: boolean;
  stops: ScheduleStop[];
}

export function Timeline({ result, isLoading, stops }: TimelineProps) {
  return (
    <section
      className="grid items-stretch grid-cols-[minmax(300px,0.34fr)_minmax(0,0.66fr)] gap-5 print:hidden max-[1120px]:grid-cols-1"
      aria-label="Route timeline"
    >
      <ComplianceSummary result={result} isLoading={isLoading} layout="vertical" />

      <Card className="dashboard-card h-full rounded-[1.25rem] shadow-none ring-1 ring-border/80">
        <CardHeader className="gap-2">
          <CardDescription className="section-kicker-card">Schedule</CardDescription>
          <CardTitle className="section-title">
            Stops and rests
          </CardTitle>
        </CardHeader>

        <CardContent>
          {stops.length ? (
            <ItemGroup className="schedule-list gap-2.5">
              {stops.map((stop, index) => {
                const label = getStopLabel(stop);
                const isRestStop =
                  stop.type === "rest" || stop.type === "restart";

                return (
                  <Item
                    key={`${stop.type}-${stop.hour}-${index}`}
                    className="timeline-item"
                    role="listitem"
                    variant={isRestStop ? "muted" : "outline"}
                  >
                    <ItemMedia>
                      <Badge variant={isRestStop ? "secondary" : "default"}>
                        {label}
                      </Badge>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="line-clamp-none">
                        {stop.location}
                      </ItemTitle>
                      <ItemDescription>
                        {formatHourOffset(stop.hour)} ·{" "}
                        {formatHours(stop.duration_hours)} scheduled
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                );
              })}
            </ItemGroup>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No scheduled stops</EmptyTitle>
                <EmptyDescription>
                  No scheduled stops were returned for this route.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

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
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RouteInstruction, ScheduleStop } from "@/types";

interface TimelineProps {
  instructions: RouteInstruction[];
  stops: ScheduleStop[];
}

export function Timeline({ instructions, stops }: TimelineProps) {
  return (
    <section
      className="grid items-stretch grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] gap-6 print:hidden max-[1120px]:grid-cols-1"
      aria-label="Route timeline"
    >
      <Card className="dashboard-card h-full rounded-2xl shadow-sm">
        <CardHeader>
          <CardDescription className="section-kicker-card">Turn-by-turn</CardDescription>
          <CardTitle className="section-title">
            Route instructions
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1">
          {instructions.length ? (
            <ScrollArea className="h-full max-h-[440px] pr-3 max-[560px]:max-h-none">
              <ItemGroup className="gap-2.5">
                {instructions.map((instruction, index) => (
                  <Item
                    key={`${instruction.text}-${index}`}
                    className="timeline-item"
                    role="listitem"
                    variant="muted"
                  >
                    <ItemMedia>
                      <Badge className="min-w-6" variant="secondary">
                        {index + 1}
                      </Badge>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="line-clamp-none">
                        {instruction.text}
                      </ItemTitle>
                      <ItemDescription>
                        {formatNumber(instruction.distance_miles)} mi ·{" "}
                        {formatMinutes(instruction.duration_minutes)}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </ScrollArea>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No route instructions</EmptyTitle>
                <EmptyDescription>
                  No route instructions were returned for this route.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card className="dashboard-card h-full rounded-2xl shadow-sm">
        <CardHeader>
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
                const isRestStop = label === "Rest" || label === "Restart";

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

function getStopLabel(stop: ScheduleStop): string {
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

function formatHourOffset(hour: number): string {
  const day = Math.floor(hour / 24) + 1;
  const hourWithinDay = hour % 24;
  const wholeHours = Math.floor(hourWithinDay);
  const minutes = Math.round((hourWithinDay - wholeHours) * 60);
  const displayHours = minutes === 60 ? wholeHours + 1 : wholeHours;
  const displayMinutes = minutes === 60 ? 0 : minutes;

  return `Day ${day}, ${displayHours.toString().padStart(2, "0")}:${displayMinutes.toString().padStart(2, "0")}`;
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    value,
  );
}

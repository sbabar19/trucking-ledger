import { Badge } from "@/components/ui/badge";
import type { PlannerLocations } from "@/components/planner/types";

interface PlanningHeroProps {
  locations: PlannerLocations;
  currentCycleUsed: string;
}

export function PlanningHero({
  locations,
  currentCycleUsed,
}: PlanningHeroProps) {
  return (
    <div className="booking-hero rounded-[1.4rem] px-5 pt-8 pb-16 sm:px-7 sm:pt-10 md:px-10 md:pb-20">
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div className="flex max-w-3xl flex-col items-start gap-4 text-left">
          <Badge
            className="border-foreground/10 bg-background/70 text-foreground shadow-none"
            variant="outline"
          >
            Trucking Ledger
          </Badge>
          <div className="grid gap-3">
            <h1 className="max-w-[760px] text-balance font-sans text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl">
              Plan a compliant trip from dispatch to delivery.
            </h1>
            <p className="max-w-[56ch] text-base leading-7 text-muted-foreground sm:text-lg">
              Enter the route and cycle hours; get stops, drive time, and
              printable daily logs.
            </p>
          </div>
        </div>

        <aside
          className="dispatch-brief rounded-2xl p-4"
          aria-label="Current route draft"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Current draft
            </span>
            <Badge variant="secondary">70 hr cycle</Badge>
          </div>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="route-brief-row">
              <dt>Origin</dt>
              <dd>{locations.current_location.value}</dd>
            </div>
            <div className="route-brief-row">
              <dt>Pickup</dt>
              <dd>{locations.pickup_location.value}</dd>
            </div>
            <div className="route-brief-row">
              <dt>Dropoff</dt>
              <dd>{locations.dropoff_location.value}</dd>
            </div>
            <div className="route-brief-row">
              <dt>Cycle used</dt>
              <dd>{currentCycleUsed || "0"} hr</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}

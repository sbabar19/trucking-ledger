import { DailyLogPanel } from "@/components/planner/DailyLogPanel";
import { ComplianceSummary } from "@/components/planner/ComplianceSummary";
import { Timeline } from "@/components/Timeline";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TripPlanResponse } from "@/types";

interface ResultsSectionProps {
  result: TripPlanResponse | null;
  isLoading: boolean;
  selectedLogDayIndex: number;
  onPreviousLogDay: () => void;
  onNextLogDay: () => void;
  onPrintSelectedLogDay: () => void;
}

export function ResultsSection({
  result,
  isLoading,
  selectedLogDayIndex,
  onPreviousLogDay,
  onNextLogDay,
  onPrintSelectedLogDay,
}: ResultsSectionProps) {
  const selectedLogDay = result?.schedule.days[selectedLogDayIndex];
  const logDayCount = result?.schedule.days.length ?? 0;

  if (!result && !isLoading) {
    return null;
  }

  return (
    <section
      className="mx-auto mt-6 grid max-w-[1480px] min-w-0 gap-5"
      aria-live="polite"
    >
      <ComplianceSummary result={result} isLoading={isLoading} />

      {isLoading ? (
        <Card
          className="dashboard-card rounded-[1.25rem] shadow-none ring-1 ring-border/80"
          role="status"
        >
          <CardHeader className="gap-2">
            <CardTitle>Building compliant plan</CardTitle>
            <CardDescription>
              Routing, stop scheduling, and daily log sheets are being
              generated.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-2/3" />
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <>
          <Timeline
            instructions={result.route.instructions}
            stops={result.schedule.stops}
          />
          <DailyLogPanel
            selectedLogDay={selectedLogDay}
            selectedLogDayIndex={selectedLogDayIndex}
            logDayCount={logDayCount}
            onPreviousDay={onPreviousLogDay}
            onNextDay={onNextLogDay}
            onPrintSelectedLogDay={onPrintSelectedLogDay}
          />
        </>
      ) : null}
    </section>
  );
}

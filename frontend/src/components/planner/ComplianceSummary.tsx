import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TripPlanResponse } from "@/types";

interface ComplianceSummaryProps {
  result: TripPlanResponse | null;
  isLoading: boolean;
  layout?: "horizontal" | "vertical";
}

interface MetricProps {
  label: string;
  value: string;
  isLoading?: boolean;
  tone?: "default" | "success" | "warning" | "danger";
}

export function ComplianceSummary({
  result,
  isLoading,
  layout = "horizontal",
}: ComplianceSummaryProps) {
  const lastLogDay = result?.schedule.days.at(-1);
  const cycleUsed = lastLogDay?.recap.cycle_used_end ?? null;
  const cycleRemaining = lastLogDay?.recap.cycle_available_end ?? null;

  return (
    <Card className="dashboard-card h-full rounded-[1.25rem] shadow-none ring-1 ring-border/80">
      <CardHeader className="gap-2 pb-2">
        <CardDescription className="section-kicker-card">
          Compliance summary
        </CardDescription>
        <CardTitle className="section-title">
          {result ? "Plan generated" : "Awaiting dispatch request"}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div
          className={cn("grid gap-3", {
            "grid-cols-5 max-[1120px]:grid-cols-2 max-[560px]:grid-cols-1":
              layout === "horizontal",
            "grid-cols-1": layout === "vertical",
          })}
        >
          <Metric
            label="Total miles"
            value={result ? formatNumber(result.route.distance_miles) : "---"}
            isLoading={isLoading && !result}
          />
          <Metric
            label="Route hours"
            value={result ? formatHours(result.route.duration_hours) : "---"}
            isLoading={isLoading && !result}
          />
          <Metric
            label="Log days"
            value={result ? String(result.schedule.days.length) : "---"}
            isLoading={isLoading && !result}
          />
          <Metric
            label="Cycle used"
            value={cycleUsed === null ? "---" : formatHours(cycleUsed)}
            isLoading={isLoading && !result}
          />
          <Metric
            label="Cycle remaining"
            value={
              cycleRemaining === null ? "---" : formatHours(cycleRemaining)
            }
            isLoading={isLoading && !result}
            tone={getCycleRemainingTone(cycleRemaining)}
          />
        </div>
      </CardContent>

      {result ? (
        <CardFooter
          className="flex flex-wrap gap-2 bg-muted/40"
          aria-label="Schedule assumptions"
        >
          {result.schedule.assumptions.map((assumption) => (
            <Badge key={assumption} variant="outline">
              {assumption}
            </Badge>
          ))}
        </CardFooter>
      ) : null}
    </Card>
  );
}

function Metric({
  label,
  value,
  isLoading = false,
  tone = "default",
}: MetricProps) {
  return (
    <Card
      className={cn("metric-card min-h-30 rounded-xl shadow-none", {
        "metric-card--success": tone === "success",
        "metric-card--warning": tone === "warning",
        "metric-card--danger": tone === "danger",
      })}
    >
      <CardHeader className="h-full content-between gap-4">
        <CardDescription className="metric-label text-xs">
          {label}
        </CardDescription>
        {isLoading ? (
          <Skeleton className="h-12 w-32" />
        ) : (
          <CardTitle className="metric-value text-[2.35rem] font-semibold leading-none text-foreground lg:text-[2.9rem]">
            {value}
          </CardTitle>
        )}
      </CardHeader>
    </Card>
  );
}

function getCycleRemainingTone(
  cycleRemaining: number | null,
): MetricProps["tone"] {
  if (cycleRemaining === null) {
    return "default";
  }
  if (cycleRemaining <= 0) {
    return "danger";
  }
  if (cycleRemaining < 8) {
    return "warning";
  }
  return "success";
}

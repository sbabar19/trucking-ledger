import "@/App.css";

import { planTrip } from "@/api";
import { LocationInput } from "@/components/LocationInput";
import { LogSheet } from "@/components/LogSheet";
import { MapPanel } from "@/components/MapPanel";
import { Timeline } from "@/components/Timeline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LocationSuggestion } from "@/lib/mapboxGeocoding";
import type {
  Coordinates,
  LocationFieldKey,
  LocationSelectionMap,
  TripPlanRequest,
  TripPlanResponse,
} from "@/types";
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

interface PlannerLocationState {
  value: string;
  coordinates: Coordinates | null;
}

type PlannerLocations = Record<LocationFieldKey, PlannerLocationState>;

const DEFAULT_LOCATIONS: PlannerLocations = {
  current_location: { value: "Dallas, TX", coordinates: null },
  pickup_location: { value: "Phoenix, AZ", coordinates: null },
  dropoff_location: { value: "Los Angeles, CA", coordinates: null },
};

const DEFAULT_CYCLE_USED = "12";

function App() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [locations, setLocations] =
    useState<PlannerLocations>(DEFAULT_LOCATIONS);
  const [currentCycleUsed, setCurrentCycleUsed] = useState(DEFAULT_CYCLE_USED);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [selectedLogDayIndex, setSelectedLogDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationMessage = validateForm(locations, currentCycleUsed);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const request: TripPlanRequest = {
      current_location: locations.current_location.value.trim(),
      pickup_location: locations.pickup_location.value.trim(),
      dropoff_location: locations.dropoff_location.value.trim(),
      current_cycle_used: Number(currentCycleUsed),
      ...(locations.current_location.coordinates
        ? { current_coordinates: locations.current_location.coordinates }
        : {}),
      ...(locations.pickup_location.coordinates
        ? { pickup_coordinates: locations.pickup_location.coordinates }
        : {}),
      ...(locations.dropoff_location.coordinates
        ? { dropoff_coordinates: locations.dropoff_location.coordinates }
        : {}),
    };

    setIsLoading(true);
    setErrorMessage("");

    try {
      setResult(await planTrip(request));
      setSelectedLogDayIndex(0);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Trip planning failed",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateLocation = (
    field: LocationFieldKey,
    value: string,
    coordinates: Coordinates | null,
  ) => {
    setLocations((previousLocations) => ({
      ...previousLocations,
      [field]: { value, coordinates },
    }));
  };

  const handleSuggestionSelect = (
    field: LocationFieldKey,
    suggestion: LocationSuggestion,
  ) => {
    updateLocation(field, suggestion.label, suggestion.coordinates);
    setErrorMessage("");
  };

  const lastLogDay = result?.schedule.days.at(-1);
  const selectedLogDay = result?.schedule.days[selectedLogDayIndex];
  const logDayCount = result?.schedule.days.length ?? 0;
  const cycleUsed = lastLogDay?.recap.cycle_used_end ?? null;
  const cycleRemaining = lastLogDay?.recap.cycle_available_end ?? null;
  const locationSummary: LocationSelectionMap = {
    current_location: {
      label: locations.current_location.value,
      coordinates: locations.current_location.coordinates,
    },
    pickup_location: {
      label: locations.pickup_location.value,
      coordinates: locations.pickup_location.coordinates,
    },
    dropoff_location: {
      label: locations.dropoff_location.value,
      coordinates: locations.dropoff_location.coordinates,
    },
  };

  return (
    <main className="app-shell min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-5 lg:px-7">
      <section
        className="mx-auto grid max-w-[1480px] grid-cols-1 gap-5"
        aria-label="Trip planner input"
      >
        <div>
          <div className="booking-hero rounded-[1.75rem] px-5 pt-10 pb-24 text-center shadow-lg shadow-foreground/5 sm:pt-12 md:px-10 md:pb-28">
            <div className="relative z-1 mx-auto flex max-w-3xl flex-col items-center gap-3">
              <Badge
                className="border-white/25 bg-white/15 text-white shadow-none"
                variant="outline"
              >
                Trucking Ledger
              </Badge>
              <h1 className="max-w-3xl font-serif text-4xl leading-[1.05] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
                Plan compliant trips.
              </h1>
            </div>
          </div>

          <Card className="dashboard-card booking-search-card mx-auto max-w-[1320px] rounded-2xl bg-card py-5 shadow-xl shadow-foreground/10 ring-1 ring-foreground/10">
            <CardContent className="px-5 sm:px-6">
              <form
                className="flex flex-col gap-5"
                onSubmit={handleSubmit}
                noValidate
              >
                <FieldGroup className="booking-field-grid grid grid-cols-[repeat(3,minmax(190px,1fr))_minmax(150px,0.62fr)_auto] items-end gap-2.5 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
                  <LocationInput
                    id="current_location"
                    label="Current location"
                    value={locations.current_location.value}
                    coordinates={locations.current_location.coordinates}
                    accessToken={mapboxToken}
                    className="booking-field"
                    inputClassName="h-13 rounded-xl px-3 text-base md:text-base"
                    onChange={(value) =>
                      updateLocation("current_location", value, null)
                    }
                    onSelectSuggestion={(suggestion) =>
                      handleSuggestionSelect("current_location", suggestion)
                    }
                  />

                  <LocationInput
                    id="pickup_location"
                    label="Pickup location"
                    value={locations.pickup_location.value}
                    coordinates={locations.pickup_location.coordinates}
                    accessToken={mapboxToken}
                    className="booking-field"
                    inputClassName="h-13 rounded-xl px-3 text-base md:text-base"
                    onChange={(value) =>
                      updateLocation("pickup_location", value, null)
                    }
                    onSelectSuggestion={(suggestion) =>
                      handleSuggestionSelect("pickup_location", suggestion)
                    }
                  />

                  <LocationInput
                    id="dropoff_location"
                    label="Dropoff location"
                    value={locations.dropoff_location.value}
                    coordinates={locations.dropoff_location.coordinates}
                    accessToken={mapboxToken}
                    className="booking-field"
                    inputClassName="h-13 rounded-xl px-3 text-base md:text-base"
                    onChange={(value) =>
                      updateLocation("dropoff_location", value, null)
                    }
                    onSelectSuggestion={(suggestion) =>
                      handleSuggestionSelect("dropoff_location", suggestion)
                    }
                  />

                  <Field className="booking-field">
                    <FieldLabel htmlFor="current-cycle-used">
                      Current cycle used
                    </FieldLabel>
                    <Input
                      id="current-cycle-used"
                      className="h-13 rounded-xl px-3 text-base md:text-base"
                      value={currentCycleUsed}
                      onChange={(event) =>
                        setCurrentCycleUsed(event.target.value)
                      }
                      placeholder="12"
                      inputMode="decimal"
                    />
                  </Field>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-13 min-w-32 rounded-xl px-7 text-base font-semibold max-[1180px]:col-span-2 max-[640px]:col-span-1"
                    disabled={isLoading}
                  >
                    {isLoading ? "Planning..." : "Plan"}
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </FieldGroup>

                {errorMessage ? (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                ) : null}
              </form>
            </CardContent>
          </Card>
        </div>

        <MapPanel locations={locationSummary} route={result?.route} />
      </section>

      {result || isLoading ? (
        <section
          className="mx-auto mt-5 grid max-w-[1480px] min-w-0 gap-5"
          aria-live="polite"
        >
          <Card className="dashboard-card rounded-2xl shadow-sm">
            <CardHeader>
              <CardDescription className="section-kicker-card">Compliance summary</CardDescription>
              <CardTitle className="section-title">
                {result ? "Plan generated" : "Awaiting dispatch request"}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-5 gap-3 max-[1120px]:grid-cols-2 max-[560px]:grid-cols-1">
                <Metric
                  label="Total miles"
                  value={
                    result ? formatNumber(result.route.distance_miles) : "---"
                  }
                  isLoading={isLoading && !result}
                />
                <Metric
                  label="Route hours"
                  value={
                    result ? formatHours(result.route.duration_hours) : "---"
                  }
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
                    cycleRemaining === null
                      ? "---"
                      : formatHours(cycleRemaining)
                  }
                  isLoading={isLoading && !result}
                  tone={getCycleRemainingTone(cycleRemaining)}
                />
              </div>
            </CardContent>

            {result ? (
              <CardFooter
                className="flex flex-wrap gap-2"
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

          {isLoading ? (
            <Card className="dashboard-card rounded-2xl" role="status">
              <CardHeader>
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
              <Card className="dashboard-card rounded-2xl" aria-label="Daily log sheets">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardDescription className="section-kicker-card">Filled records</CardDescription>
                    <CardTitle className="section-title">
                      Daily log sheets
                    </CardTitle>
                  </div>
                  <div className="log-day-controls" aria-label="Log day navigation">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                      disabled={selectedLogDayIndex === 0}
                      aria-label="Previous log day"
                      onClick={() =>
                        setSelectedLogDayIndex((dayIndex) => Math.max(dayIndex - 1, 0))
                      }
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <span>
                      Day {selectedLogDayIndex + 1} of {logDayCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-full"
                      disabled={selectedLogDayIndex >= logDayCount - 1}
                      aria-label="Next log day"
                      onClick={() =>
                        setSelectedLogDayIndex((dayIndex) =>
                          Math.min(dayIndex + 1, logDayCount - 1),
                        )
                      }
                    >
                      <ChevronRightIcon />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="log-sheet-scroll grid gap-6 print:block">
                    {selectedLogDay ? (
                      <LogSheet
                        key={selectedLogDay.day}
                        day={selectedLogDay}
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

interface MetricProps {
  label: string;
  value: string;
  isLoading?: boolean;
  tone?: "default" | "success" | "warning" | "danger";
}

function Metric({
  label,
  value,
  isLoading = false,
  tone = "default",
}: MetricProps) {
  return (
    <Card
      size="sm"
      className={cn("metric-card min-h-32 rounded-2xl", {
        "metric-card--success": tone === "success",
        "metric-card--warning": tone === "warning",
        "metric-card--danger": tone === "danger",
      })}
    >
      <CardHeader>
        <CardDescription className="metric-label text-xs uppercase tracking-[0.12em]">
          {label}
        </CardDescription>
        {isLoading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <CardTitle className="metric-value text-4xl font-semibold tracking-[-0.06em] text-foreground lg:text-5xl">
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

function validateForm(
  locations: PlannerLocations,
  currentCycleUsed: string,
): string {
  if (
    !locations.current_location.value.trim() ||
    !locations.pickup_location.value.trim() ||
    !locations.dropoff_location.value.trim()
  ) {
    return "Current, pickup, and dropoff locations are required.";
  }

  const cycleUsed = Number(currentCycleUsed);
  if (!Number.isFinite(cycleUsed) || cycleUsed < 0 || cycleUsed > 70) {
    return "Current cycle used must be a number between 0 and 70.";
  }

  return "";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatHours(value: number): string {
  return `${formatNumber(value)} hr`;
}

export default App;

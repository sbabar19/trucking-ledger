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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatHours, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LocationSuggestion } from "@/lib/mapboxGeocoding";
import type {
  Coordinates,
  LocationFieldKey,
  LocationSelectionMap,
  TripPlanRequest,
  TripPlanResponse,
} from "@/types";
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
} from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

interface PlannerLocationState {
  value: string;
  coordinates: Coordinates | null;
}

type PlannerLocations = Record<LocationFieldKey, PlannerLocationState>;
type PlannerFieldKey = LocationFieldKey | "current_cycle_used";
type FormErrors = Partial<Record<PlannerFieldKey, string>>;

const DEFAULT_LOCATIONS: PlannerLocations = {
  current_location: { value: "Dallas, TX", coordinates: null },
  pickup_location: { value: "Phoenix, AZ", coordinates: null },
  dropoff_location: { value: "Los Angeles, CA", coordinates: null },
};

const DEFAULT_CYCLE_USED = "12";
const CYCLE_USED_MIN = 0;
const CYCLE_USED_MAX = 70;
const BLOCKED_CYCLE_USED_KEYS = new Set(["e", "E", "+", "-"]);

function App() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [locations, setLocations] =
    useState<PlannerLocations>(DEFAULT_LOCATIONS);
  const [currentCycleUsed, setCurrentCycleUsed] = useState(DEFAULT_CYCLE_USED);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [selectedLogDayIndex, setSelectedLogDayIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateForm(locations, currentCycleUsed);
    if (hasFormErrors(validationErrors)) {
      setFormErrors(validationErrors);
      setErrorMessage("");
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
    setFormErrors({});

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
    setFormErrors((previousErrors) => clearFormError(previousErrors, field));
    setErrorMessage("");
  };

  const updateCurrentCycleUsed = (value: string) => {
    setCurrentCycleUsed(constrainCycleUsedInput(value));
    setFormErrors((previousErrors) =>
      clearFormError(previousErrors, "current_cycle_used"),
    );
    setErrorMessage("");
  };

  const handleSuggestionSelect = (
    field: LocationFieldKey,
    suggestion: LocationSuggestion,
  ) => {
    updateLocation(field, suggestion.label, suggestion.coordinates);
    setErrorMessage("");
  };

  const handlePrintSelectedLogDay = () => {
    window.print();
  };

  const lastLogDay = result?.schedule.days.at(-1);
  const selectedLogDay = result?.schedule.days[selectedLogDayIndex];
  const logDayCount = result?.schedule.days.length ?? 0;
  const cycleUsed = lastLogDay?.recap.cycle_used_end ?? null;
  const cycleRemaining = lastLogDay?.recap.cycle_available_end ?? null;
  const currentCycleUsedError = formErrors.current_cycle_used;
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
    <main className="app-shell min-h-dvh overflow-hidden px-3 py-4 text-foreground sm:px-5 lg:px-8">
      <section
        className="mx-auto grid max-w-[1480px] grid-cols-1 gap-5"
        aria-label="Trip planner input"
      >
        <div>
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

          <Card className="dashboard-card booking-search-card mx-auto max-w-[1320px] rounded-[1.25rem] bg-card py-4 shadow-none ring-1 ring-border/80">
            <CardContent className="px-4 sm:px-5">
              <form
                className="flex flex-col gap-5"
                onSubmit={handleSubmit}
                noValidate
              >
                <FieldGroup className="booking-field-grid grid grid-cols-[repeat(3,minmax(190px,1fr))_minmax(150px,0.62fr)_auto] items-start gap-3 max-[1180px]:grid-cols-2 max-[640px]:grid-cols-1">
                  <LocationInput
                    id="current_location"
                    label="Current location"
                    value={locations.current_location.value}
                    coordinates={locations.current_location.coordinates}
                    accessToken={mapboxToken}
                    className="booking-field"
                    inputClassName="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
                    error={formErrors.current_location}
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
                    inputClassName="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
                    error={formErrors.pickup_location}
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
                    inputClassName="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
                    error={formErrors.dropoff_location}
                    onChange={(value) =>
                      updateLocation("dropoff_location", value, null)
                    }
                    onSelectSuggestion={(suggestion) =>
                      handleSuggestionSelect("dropoff_location", suggestion)
                    }
                  />

                  <Field
                    className="booking-field"
                    data-invalid={Boolean(currentCycleUsedError) || undefined}
                  >
                    <FieldLabel htmlFor="current-cycle-used">
                      Current cycle used
                    </FieldLabel>
                    <Input
                      id="current-cycle-used"
                      type="number"
                      className="h-12 rounded-lg bg-background/80 px-3 text-base md:text-base"
                      value={currentCycleUsed}
                      onChange={(event) =>
                        updateCurrentCycleUsed(event.target.value)
                      }
                      onKeyDown={handleCycleUsedKeyDown}
                      placeholder="12"
                      min={CYCLE_USED_MIN}
                      max={CYCLE_USED_MAX}
                      step="any"
                      inputMode="decimal"
                      aria-describedby={
                        currentCycleUsedError
                          ? "current-cycle-used-error"
                          : undefined
                      }
                      aria-invalid={Boolean(currentCycleUsedError) || undefined}
                      required
                    />
                    <FieldError id="current-cycle-used-error">
                      {currentCycleUsedError}
                    </FieldError>
                  </Field>

                  <Button
                    type="submit"
                    size="lg"
                    className="h-12 min-w-32 rounded-lg px-7 text-base font-semibold max-[1180px]:col-span-2 max-[640px]:col-span-1"
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

        <MapPanel
          locations={locationSummary}
          route={result?.route}
          stops={result?.schedule.stops}
        />
      </section>

      {result || isLoading ? (
        <section
          className="mx-auto mt-6 grid max-w-[1480px] min-w-0 gap-5"
          aria-live="polite"
        >
          <Card className="dashboard-card rounded-[1.25rem] shadow-none ring-1 ring-border/80">
            <CardHeader className="gap-2 pb-2">
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
              <Card
                className="dashboard-card rounded-[1.25rem] shadow-none ring-1 ring-border/80"
                aria-label="Daily log sheets"
              >
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
                      className="size-9 rounded-lg"
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
                      className="size-9 rounded-lg"
                      aria-label={`Print day ${selectedLogDayIndex + 1} log`}
                      disabled={!selectedLogDay}
                      onClick={handlePrintSelectedLogDay}
                    >
                      <PrinterIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-9 rounded-lg"
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
      className={cn("metric-card min-h-36 rounded-xl shadow-none", {
        "metric-card--success": tone === "success",
        "metric-card--warning": tone === "warning",
        "metric-card--danger": tone === "danger",
      })}
    >
      <CardHeader className="h-full content-between gap-5">
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

function validateForm(
  locations: PlannerLocations,
  currentCycleUsed: string,
): FormErrors {
  const errors: FormErrors = {};

  if (!locations.current_location.value.trim()) {
    errors.current_location = "Current location is required.";
  }

  if (!locations.pickup_location.value.trim()) {
    errors.pickup_location = "Pickup location is required.";
  }

  if (!locations.dropoff_location.value.trim()) {
    errors.dropoff_location = "Dropoff location is required.";
  }

  const cycleUsedInput = currentCycleUsed.trim();
  const cycleUsed = Number(cycleUsedInput);

  if (!cycleUsedInput) {
    errors.current_cycle_used = "Current cycle used is required.";
  } else if (!Number.isFinite(cycleUsed)) {
    errors.current_cycle_used = "Current cycle used must be a number.";
  } else if (cycleUsed < CYCLE_USED_MIN || cycleUsed > CYCLE_USED_MAX) {
    errors.current_cycle_used = `Current cycle used must be between ${CYCLE_USED_MIN} and ${CYCLE_USED_MAX} hours.`;
  }

  return errors;
}

function constrainCycleUsedInput(value: string): string {
  if (!value.trim()) {
    return "";
  }

  const cycleUsed = Number(value);
  if (!Number.isFinite(cycleUsed)) {
    return value;
  }

  if (cycleUsed < CYCLE_USED_MIN) {
    return String(CYCLE_USED_MIN);
  }

  if (cycleUsed > CYCLE_USED_MAX) {
    return String(CYCLE_USED_MAX);
  }

  return value;
}

function handleCycleUsedKeyDown(event: KeyboardEvent<HTMLInputElement>) {
  if (BLOCKED_CYCLE_USED_KEYS.has(event.key)) {
    event.preventDefault();
  }
}

function hasFormErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

function clearFormError(errors: FormErrors, field: PlannerFieldKey): FormErrors {
  if (!errors[field]) {
    return errors;
  }

  const nextErrors = { ...errors };
  delete nextErrors[field];
  return nextErrors;
}

export default App;

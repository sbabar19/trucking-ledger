import { useState, type FormEvent } from 'react';
import './App.css';
import { planTrip } from './api';
import { LogSheet } from './components/LogSheet';
import { LocationInput } from './components/LocationInput';
import { MapPanel } from './components/MapPanel';
import { Timeline } from './components/Timeline';
import { reverseGeocodeLocation, type LocationSuggestion } from './lib/mapboxGeocoding';
import type { Coordinates, LocationFieldKey, LocationSelectionMap, TripPlanRequest, TripPlanResponse } from './types';

interface PlannerLocationState {
  value: string;
  coordinates: Coordinates | null;
}

type PlannerLocations = Record<LocationFieldKey, PlannerLocationState>;

const DEFAULT_LOCATIONS: PlannerLocations = {
  current_location: { value: 'Dallas, TX', coordinates: null },
  pickup_location: { value: 'Phoenix, AZ', coordinates: null },
  dropoff_location: { value: 'Los Angeles, CA', coordinates: null },
};

const FIELD_LABELS: Record<LocationFieldKey, string> = {
  current_location: 'Current location',
  pickup_location: 'Pickup location',
  dropoff_location: 'Dropoff location',
};

const DEFAULT_CYCLE_USED = '12';

function App() {
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const [locations, setLocations] = useState<PlannerLocations>(DEFAULT_LOCATIONS);
  const [currentCycleUsed, setCurrentCycleUsed] = useState(DEFAULT_CYCLE_USED);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeField, setActiveField] = useState<LocationFieldKey>('current_location');

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
      ...(locations.current_location.coordinates ? { current_coordinates: locations.current_location.coordinates } : {}),
      ...(locations.pickup_location.coordinates ? { pickup_coordinates: locations.pickup_location.coordinates } : {}),
      ...(locations.dropoff_location.coordinates ? { dropoff_coordinates: locations.dropoff_location.coordinates } : {}),
    };

    setIsLoading(true);
    setErrorMessage('');

    try {
      setResult(await planTrip(request));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Trip planning failed');
    } finally {
      setIsLoading(false);
    }
  };

  const updateLocation = (field: LocationFieldKey, value: string, coordinates: Coordinates | null) => {
    setLocations((previousLocations) => ({
      ...previousLocations,
      [field]: { value, coordinates },
    }));
  };

  const handleSuggestionSelect = (field: LocationFieldKey, suggestion: LocationSuggestion) => {
    updateLocation(field, suggestion.label, suggestion.coordinates);
    setErrorMessage('');
  };

  const handleMapClick = async (coordinates: Coordinates) => {
    if (!mapboxToken) {
      return;
    }

    try {
      const suggestion = await reverseGeocodeLocation(coordinates, mapboxToken);
      updateLocation(
        activeField,
        suggestion?.label ?? `${FIELD_LABELS[activeField]} (${formatCoordinatePair(coordinates)})`,
        coordinates,
      );
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not resolve the selected map location');
    }
  };

  const lastLogDay = result?.schedule.days.at(-1);
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
    <main className="planner-shell">
      <section className="route-builder-grid" aria-label="Trip planner input">
        <div className="planner-card input-card">
          <div className="card-header">
            <div>
              <p className="section-kicker">Trucking Ledger</p>
              <h2>Route inputs</h2>
            </div>
            <span className="status-pill status-pill-cyan">70 hr / 8 day cycle</span>
          </div>

          <form className="trip-form" onSubmit={handleSubmit} noValidate>
            <div className="route-input-row">
              <LocationInput
                id="current_location"
                label="Current location"
                value={locations.current_location.value}
                coordinates={locations.current_location.coordinates}
                accessToken={mapboxToken}
                isActive={activeField === 'current_location'}
                onActivate={() => setActiveField('current_location')}
                onChange={(value) => updateLocation('current_location', value, null)}
                onSelectSuggestion={(suggestion) => handleSuggestionSelect('current_location', suggestion)}
              />

              <LocationInput
                id="pickup_location"
                label="Pickup location"
                value={locations.pickup_location.value}
                coordinates={locations.pickup_location.coordinates}
                accessToken={mapboxToken}
                isActive={activeField === 'pickup_location'}
                onActivate={() => setActiveField('pickup_location')}
                onChange={(value) => updateLocation('pickup_location', value, null)}
                onSelectSuggestion={(suggestion) => handleSuggestionSelect('pickup_location', suggestion)}
              />

              <LocationInput
                id="dropoff_location"
                label="Dropoff location"
                value={locations.dropoff_location.value}
                coordinates={locations.dropoff_location.coordinates}
                accessToken={mapboxToken}
                isActive={activeField === 'dropoff_location'}
                onActivate={() => setActiveField('dropoff_location')}
                onChange={(value) => updateLocation('dropoff_location', value, null)}
                onSelectSuggestion={(suggestion) => handleSuggestionSelect('dropoff_location', suggestion)}
              />

              <label>
                Current cycle used
                <input
                  value={currentCycleUsed}
                  onChange={(event) => setCurrentCycleUsed(event.target.value)}
                  placeholder="12"
                  inputMode="decimal"
                />
              </label>
            </div>

            {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}

            <button className="primary-action" type="submit" disabled={isLoading}>
              {isLoading ? 'Planning route...' : 'Plan compliant trip'}
            </button>
          </form>
        </div>

        <MapPanel
          activeField={activeField}
          locations={locationSummary}
          route={result?.route}
          onActivateField={setActiveField}
          onMapClick={handleMapClick}
        />
      </section>

      {(result || isLoading) ? (
        <section className="results-stack" aria-live="polite">
          <div className="planner-card summary-card">
            <div className="card-header">
              <p className="section-kicker">Compliance summary</p>
              <h2>{result ? 'Plan generated' : 'Awaiting dispatch request'}</h2>
            </div>

            <div className="summary-grid">
              <Metric label="Total miles" value={result ? formatNumber(result.route.distance_miles) : '---'} />
              <Metric label="Route hours" value={result ? formatHours(result.route.duration_hours) : '---'} />
              <Metric label="Log days" value={result ? String(result.schedule.days.length) : '---'} />
              <Metric label="Cycle used" value={cycleUsed === null ? '---' : formatHours(cycleUsed)} />
              <Metric label="Cycle remaining" value={cycleRemaining === null ? '---' : formatHours(cycleRemaining)} />
            </div>

            {result ? (
              <div className="assumption-row" aria-label="Schedule assumptions">
                {result.schedule.assumptions.map((assumption) => (
                  <span key={assumption}>{assumption}</span>
                ))}
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="planner-card loading-card" role="status">
              <span className="loader-line" />
              <div>
                <h2>Building compliant plan</h2>
                <p>Routing, stop scheduling, and daily log sheets are being generated.</p>
              </div>
            </div>
          ) : null}

          {result ? (
            <>
              <Timeline instructions={result.route.instructions} stops={result.schedule.stops} />
              <section className="planner-card logs-card" aria-label="Daily log sheets">
                <div className="card-header">
                  <p className="section-kicker">Filled records</p>
                  <h2>Daily log sheets</h2>
                </div>
                <div className="log-stack">
                  {result.schedule.days.map((day) => (
                    <LogSheet key={day.day} day={day} stops={result.schedule.stops} />
                  ))}
                </div>
              </section>
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
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function validateForm(locations: PlannerLocations, currentCycleUsed: string): string {
  if (!locations.current_location.value.trim() || !locations.pickup_location.value.trim() || !locations.dropoff_location.value.trim()) {
    return 'Current, pickup, and dropoff locations are required.';
  }

  const cycleUsed = Number(currentCycleUsed);
  if (!Number.isFinite(cycleUsed) || cycleUsed < 0 || cycleUsed > 70) {
    return 'Current cycle used must be a number between 0 and 70.';
  }

  return '';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}

function formatHours(value: number): string {
  return `${formatNumber(value)} hr`;
}

function formatCoordinatePair(coordinates: Coordinates): string {
  return `${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`;
}

export default App;

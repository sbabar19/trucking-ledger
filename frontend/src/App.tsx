import { useState, type FormEvent } from 'react';
import './App.css';
import { planTrip } from './api';
import { LogSheet } from './components/LogSheet';
import { MapPanel } from './components/MapPanel';
import { Timeline } from './components/Timeline';
import type { TripPlanRequest, TripPlanResponse } from './types';

interface PlannerFormState {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used: string;
}

const DEFAULT_FORM: PlannerFormState = {
  current_location: 'Dallas, TX',
  pickup_location: 'Phoenix, AZ',
  dropoff_location: 'Los Angeles, CA',
  current_cycle_used: '12',
};

function App() {
  const [form, setForm] = useState<PlannerFormState>(DEFAULT_FORM);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationMessage = validateForm(form);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const request: TripPlanRequest = {
      current_location: form.current_location.trim(),
      pickup_location: form.pickup_location.trim(),
      dropoff_location: form.dropoff_location.trim(),
      current_cycle_used: Number(form.current_cycle_used),
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

  const lastLogDay = result?.schedule.days.at(-1);
  const cycleUsed = lastLogDay?.recap.cycle_used_end ?? null;
  const cycleRemaining = lastLogDay?.recap.cycle_available_end ?? null;

  return (
    <main className="planner-shell">
      <section className="hero-panel" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Dispatch planning command center</p>
          <h1 id="app-title">Trucking Ledger</h1>
          <p className="hero-copy">
            Plan a compliant trip, inspect route instructions, and review filled daily logs from the backend HOS schedule.
          </p>
        </div>
        <div className="hero-metrics" aria-label="Planning capabilities">
          <span>70 hr / 8 day cycle</span>
          <span>Live route schedule</span>
          <span>Printable log sheets</span>
        </div>
      </section>

      <div className="workspace-grid">
        <aside className="planner-card input-card" aria-label="Trip planner input">
          <div className="card-header">
            <p className="section-kicker">Trip request</p>
            <h2>Route inputs</h2>
          </div>

          <form className="trip-form" onSubmit={handleSubmit} noValidate>
            <label>
              Current location
              <input
                value={form.current_location}
                onChange={(event) => setForm({ ...form, current_location: event.target.value })}
                placeholder="Dallas, TX"
                autoComplete="address-level2"
              />
            </label>

            <label>
              Pickup location
              <input
                value={form.pickup_location}
                onChange={(event) => setForm({ ...form, pickup_location: event.target.value })}
                placeholder="Phoenix, AZ"
                autoComplete="address-level2"
              />
            </label>

            <label>
              Dropoff location
              <input
                value={form.dropoff_location}
                onChange={(event) => setForm({ ...form, dropoff_location: event.target.value })}
                placeholder="Los Angeles, CA"
                autoComplete="address-level2"
              />
            </label>

            <label>
              Current cycle used
              <input
                value={form.current_cycle_used}
                onChange={(event) => setForm({ ...form, current_cycle_used: event.target.value })}
                placeholder="12"
                inputMode="decimal"
              />
            </label>

            {errorMessage ? <p className="form-error" role="alert">{errorMessage}</p> : null}

            <button className="primary-action" type="submit" disabled={isLoading}>
              {isLoading ? 'Planning route...' : 'Plan compliant trip'}
            </button>
          </form>
        </aside>

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
              <MapPanel route={result.route} />
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
          ) : (
            <div className="planner-card empty-state">
              <span>TL</span>
              <h2>Submit a route to generate dispatch artifacts</h2>
              <p>The planner will return route geometry, instructions, scheduled stops, rest breaks, and printable logs.</p>
            </div>
          )}
        </section>
      </div>
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

function validateForm(form: PlannerFormState): string {
  if (!form.current_location.trim() || !form.pickup_location.trim() || !form.dropoff_location.trim()) {
    return 'Current, pickup, and dropoff locations are required.';
  }

  const cycleUsed = Number(form.current_cycle_used);
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

export default App;

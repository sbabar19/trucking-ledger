# Trucking Ledger

Trucking Ledger is a Django + React trip planner for dispatchers and drivers. It generates compliant trip plans, route instructions, stop/rest timing, and daily log sheets from one app.

## Features

- Trip form for origin, pickup, dropoff, and cycle usage
- Frontend Mapbox autocomplete and click-to-pick locations
- Route map with fallback when the public Mapbox token is missing
- Turn-by-turn route instructions and stop summaries
- Daily log sheets and HOS schedule recap

## Local Development

Backend:

```bash
python3 -m venv backend/venv
backend/venv/bin/python -m pip install -r backend/requirements.txt
cd backend && ./venv/bin/python manage.py runserver 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to `http://localhost:8000`.

## Container Deployment

The default deployment is one Docker image, one origin, and one container. Django serves the React SPA and the API from the same host, and WhiteNoise serves static assets from `/static/`.

This works on EC2, Railway, Fly.io, Render, DigitalOcean, or any other Docker-capable host. Nginx is optional only if you want an external reverse proxy or separate TLS termination.

## Environment Variables

Runtime backend variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `MAPBOX_ACCESS_TOKEN`
- `PORT`

Frontend build-time variables:

- `VITE_MAPBOX_TOKEN` powers frontend geocoding, map picking, and the route map
- `VITE_API_BASE_URL` should stay empty for the default same-origin deployment.

## Verification

- `cd backend && ./venv/bin/python manage.py check`
- `cd backend && ./venv/bin/python manage.py test trips`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `docker build --build-arg VITE_MAPBOX_TOKEN= -t trucking-ledger .`
- `docker run --rm -d --name trucking-ledger -p 8000:8000 -e DJANGO_SECRET_KEY=dummy -e DJANGO_DEBUG=False -e DJANGO_ALLOWED_HOSTS=localhost -e PORT=8000 trucking-ledger`

Smoke test the container with:

```bash
curl http://localhost:8000/
curl http://localhost:8000/api/health/
```

## Assumptions And Limitations

- Same-origin deployment is the default.
- `VITE_API_BASE_URL` stays empty unless the app is split again.
- The map falls back gracefully if `VITE_MAPBOX_TOKEN` is omitted.
- `MAPBOX_ACCESS_TOKEN` stays backend-only.
- Required 10-hour rest breaks are modeled as off duty time, not sleeper berth time.

## Submission Checklist

- Hosted URL is reachable
- Health check returns `200`
- Short-trip and long-trip smoke checks pass
- Mobile layout is usable
- No console errors in the browser
- Repository is accessible to reviewers

## Loom Outline

- App goal and dispatcher workflow
- UI walkthrough for trip planning and logs
- Backend HOS logic and schedule generation
- Docker deployment on a generic host
- Limitations and token assumptions

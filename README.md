# Trucking Ledger

Trucking Ledger is a full-stack Django + React trip planner for interstate property-carrying drivers. It takes trip details, calculates a route, schedules required HOS stops and rests, and draws daily log sheets for the generated trip.

The implementation is scoped to the assessment assumptions:

- Property-carrying driver
- 70-hour/8-day cycle
- No adverse driving conditions
- Fueling at least once every 1,000 miles
- 1 hour for pickup and 1 hour for dropoff

## What The App Does

- Accepts current location, pickup location, dropoff location, and current cycle used
- Uses Mapbox for geocoding, route distance, route duration, and map geometry
- Generates route legs from current location to pickup and pickup to dropoff
- Schedules driving, pickup, dropoff, fueling, 30-minute breaks, 10-hour rests, and 34-hour restarts
- Draws daily log sheets for each calendar day in the trip
- Shows route summary, compliance summary, stop timeline, map markers, and daily log pages

## Tech Stack

- Backend: Django, Django REST Framework, Gunicorn, WhiteNoise
- Frontend: React, Vite, TypeScript, Tailwind CSS, Mapbox GL
- Routing/geocoding: Mapbox
- Deployment shape: same-origin Django app serving both API and built React SPA

## Project Structure

```text
backend/
  config/                  Django project settings and URL routing
  trips/
    serializers.py         API request validation
    views.py               Trip planning API endpoint
    services/routing.py    Mapbox geocoding, directions, and stop location helpers
    services/hos.py        HOS scheduling and daily log data generation
    tests.py               Backend scheduling and API tests

frontend/
  src/api.ts               Frontend API client
  src/App.tsx              Main planner flow
  src/components/MapPanel.tsx
  src/components/Timeline.tsx
  src/components/LogSheet.tsx

package.json               Root scripts for backend + frontend workflows
LOOM_SCRIPT.md             Suggested Loom walkthrough script
Dockerfile                 Production container build
```

## Prerequisites

- Python 3.13 recommended, Python 3.12+ should work with Django 6
- Node.js 22+ and npm
- A Mapbox access token
- Git

For production server deployment:

- Linux server such as Ubuntu
- Nginx
- A domain name pointed at the server
- Optional but recommended: Certbot for HTTPS

## Environment Variables

Backend runtime variables live in `backend/.env`.

Create it from the example:

```bash
cp backend/.env.example backend/.env
```

Local example:

```env
DJANGO_SECRET_KEY=replace-me-with-a-generated-secret
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3001
MAPBOX_ACCESS_TOKEN=replace-me
```

Production example:

```env
DJANGO_SECRET_KEY=use-a-long-random-production-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
MAPBOX_ACCESS_TOKEN=your-mapbox-token
PORT=8000
```

Frontend build-time variables:

- `VITE_MAPBOX_TOKEN`: public Mapbox token used by the browser for autocomplete and map display
- `VITE_API_BASE_URL`: keep empty for the default same-origin deployment

For local development, copy the frontend example env file and fill in the public Mapbox token:

```bash
cp frontend/.env.example frontend/.env.local
```

```env
VITE_MAPBOX_TOKEN=your-public-mapbox-token
VITE_API_BASE_URL=
```

## Root Scripts

Run these from the repository root:

```bash
npm run dev:backend      # Django dev server on port 8000
npm run dev:frontend     # Vite dev server on port 3001
npm run check:backend    # Django system check
npm run test             # Backend tests + frontend lint
npm run test:backend     # Django tests only
npm run test:frontend    # Frontend lint only
npm run lint             # Frontend lint
npm run build            # Frontend production build
npm run verify           # Backend check, tests, lint, and frontend build
```

## Local Setup

1. Clone the repository.

```bash
git clone <repo-url>
cd trucking-ledger
```

2. Create and populate the backend environment file.

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set `MAPBOX_ACCESS_TOKEN`.

3. Create the Python virtual environment and install backend dependencies.

```bash
python3 -m venv backend/venv
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/python -m pip install -r backend/requirements.txt
```

4. Install frontend dependencies.

```bash
npm --prefix frontend install
```

5. Add frontend Mapbox env values.

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local` and set `VITE_MAPBOX_TOKEN`.

6. Run the backend.

```bash
npm run dev:backend
```

7. In another terminal, run the frontend.

```bash
npm run dev:frontend
```

8. Open the app.

```text
http://localhost:3001
```

The Vite dev server proxies `/api` to `http://localhost:8000`.

## Local Verification

Run the full verification command from the repository root:

```bash
npm run verify
```

This runs:

- Django system checks
- Django trip tests
- Frontend ESLint
- Frontend production build

You can also smoke test the backend health endpoint:

```bash
curl http://localhost:8000/api/health/
```

Expected response:

```json
{"status":"ok"}
```

## Production Build Notes

The production app is same-origin:

- Django serves `/api/...`
- Django serves the React `index.html` fallback for non-API routes
- Built frontend assets are served under `/static/`
- WhiteNoise can serve static files directly
- Nginx can sit in front for TLS, compression, buffering, and reverse proxying

In local development, Vite proxies `/api` to Django. That proxy is configured in `frontend/vite.config.ts`:

```ts
server: {
  port: 3001,
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

In production, there is no Vite server. Nginx sends browser requests to Gunicorn/Django, and Django handles both the API and the React fallback. That means `/api/trips/plan/` and `/api/health/` are already backend routes, while non-API paths return the React app.

If you prefer Nginx to serve the React build directly, place the built frontend at `/var/www/trucking-ledger/frontend/dist` and proxy only backend routes like `/api/` to Gunicorn. Because this Vite app builds assets with `/static/` as the base path, map `/static/assets/` to the built `dist/assets` directory.

Build the frontend before starting Django in production:

```bash
VITE_MAPBOX_TOKEN=your-public-mapbox-token VITE_API_BASE_URL= npm run build
```

Then run Django static collection:

```bash
backend/venv/bin/python backend/manage.py collectstatic --noinput
```

## Docker Deployment

The Dockerfile builds the React frontend, copies `frontend/dist` into the backend image, installs Python dependencies, and starts Gunicorn.

1. Build the image.

```bash
docker build \
  --build-arg VITE_MAPBOX_TOKEN=your-public-mapbox-token \
  --build-arg VITE_API_BASE_URL= \
  -t trucking-ledger .
```

2. Run the container.

```bash
docker run --rm -d \
  --name trucking-ledger \
  -p 127.0.0.1:8000:8000 \
  -e DJANGO_SECRET_KEY=use-a-long-random-production-secret \
  -e DJANGO_DEBUG=False \
  -e DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com \
  -e CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com \
  -e MAPBOX_ACCESS_TOKEN=your-mapbox-token \
  -e PORT=8000 \
  trucking-ledger
```

3. Smoke test locally on the server.

```bash
curl http://127.0.0.1:8000/api/health/
```

## Nginx In Front Of Docker

Install Nginx and create a site config:

```bash
sudo nano /etc/nginx/sites-available/trucking-ledger
```

Example HTTP config:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

This proxies every path to Django. That is intentional for the Docker deployment because the container already contains the built React app and Django can serve the SPA plus `/api`.

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/trucking-ledger /etc/nginx/sites-enabled/trucking-ledger
sudo nginx -t
sudo systemctl reload nginx
```

Add HTTPS with Certbot:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

After HTTPS is active, set production env values to use `https://...` origins and restart the container.

## Non-Docker Server Deployment With Gunicorn, Systemd, And Nginx

This approach runs the repo directly on a Linux server.

1. Create an app directory and clone the repo.

```bash
sudo mkdir -p /opt/trucking-ledger
sudo chown "$USER":"$USER" /opt/trucking-ledger
git clone <repo-url> /opt/trucking-ledger
cd /opt/trucking-ledger
```

2. Install backend dependencies.

```bash
python3 -m venv backend/venv
backend/venv/bin/python -m pip install --upgrade pip
backend/venv/bin/python -m pip install -r backend/requirements.txt
```

3. Install frontend dependencies and build the frontend.

```bash
npm --prefix frontend ci
VITE_MAPBOX_TOKEN=your-public-mapbox-token VITE_API_BASE_URL= npm run build
```

4. Create production env file.

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Use production values:

```env
DJANGO_SECRET_KEY=use-a-long-random-production-secret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com,www.your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
MAPBOX_ACCESS_TOKEN=your-mapbox-token
PORT=8000
```

5. Prepare Django.

```bash
backend/venv/bin/python backend/manage.py check
backend/venv/bin/python backend/manage.py migrate
backend/venv/bin/python backend/manage.py collectstatic --noinput
```

6. Create a systemd service.

```bash
sudo nano /etc/systemd/system/trucking-ledger.service
```

Example service:

```ini
[Unit]
Description=Trucking Ledger Django app
After=network.target

[Service]
User=deploy
Group=deploy
WorkingDirectory=/opt/trucking-ledger/backend
EnvironmentFile=/opt/trucking-ledger/backend/.env
ExecStart=/opt/trucking-ledger/backend/venv/bin/gunicorn config.wsgi:application --bind 127.0.0.1:8000 --workers 3
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Replace `deploy` with the Linux user that owns `/opt/trucking-ledger`, such as `ubuntu`, `deploy`, or your own server username. That user must be able to read the repo and write to `backend/db.sqlite3` if you keep SQLite.

Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable trucking-ledger
sudo systemctl start trucking-ledger
sudo systemctl status trucking-ledger
```

7. Configure Nginx.

```bash
sudo nano /etc/nginx/sites-available/trucking-ledger
```

Example config where Django serves the React fallback:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10m;

    location /static/ {
        alias /opt/trucking-ledger/backend/staticfiles/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public";
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

This config lets Nginx serve `/static/` directly and proxies everything else to Django. Django still owns `/api/...` and the React SPA fallback.

If you want to make the API proxy explicit, this equivalent config is also valid:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 10m;

    location /static/ {
        alias /opt/trucking-ledger/backend/staticfiles/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The final `location /` is still needed because Django returns `index.html` for React routes like `/`, `/trip`, or any future frontend route.

For the current deployed Nginx setup, Nginx serves the built frontend directly from `/var/www/trucking-ledger/frontend/dist` and proxies `/api/` to Django/Gunicorn:

```nginx
upstream trucking_ledger_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    server_name trucking-ledger.example.com;

    root /var/www/trucking-ledger/frontend/dist;
    index index.html;

    client_max_body_size 20m;

    access_log /var/log/nginx/trucker_ledger.access.log;
    error_log /var/log/nginx/trucker_ledger.error.log;

    location /api/ {
        proxy_pass http://trucking_ledger_backend;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";

        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /static/assets/ {
        try_files $uri =404;
        alias /var/www/trucking-ledger/frontend/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/trucking-ledger.example.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/trucking-ledger.example.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = trucking-ledger.example.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name trucking-ledger.example.com;
    return 404; # managed by Certbot
}
```

Build the frontend in place with:

```bash
cd /var/www/trucking-ledger
VITE_MAPBOX_TOKEN=your-public-mapbox-token VITE_API_BASE_URL= npm run build
```

In this custom setup, `/api/...` goes to Django, `/static/assets/...` serves Vite JS/CSS from `frontend/dist/assets`, and `/` serves `/var/www/trucking-ledger/frontend/dist/index.html`.

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/trucking-ledger /etc/nginx/sites-enabled/trucking-ledger
sudo nginx -t
sudo systemctl reload nginx
```

8. Add HTTPS.

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

9. Smoke test.

```bash
curl https://your-domain.com/api/health/
```

Expected:

```json
{"status":"ok"}
```

## Updating A Server Deployment

For Docker:

```bash
git pull
docker build --build-arg VITE_MAPBOX_TOKEN=your-public-mapbox-token --build-arg VITE_API_BASE_URL= -t trucking-ledger .
docker stop trucking-ledger
docker run --rm -d --name trucking-ledger -p 127.0.0.1:8000:8000 --env-file backend/.env -e PORT=8000 trucking-ledger
```

For systemd:

```bash
cd /opt/trucking-ledger
git pull
backend/venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci
VITE_MAPBOX_TOKEN=your-public-mapbox-token VITE_API_BASE_URL= npm run build
backend/venv/bin/python backend/manage.py migrate
backend/venv/bin/python backend/manage.py collectstatic --noinput
sudo systemctl restart trucking-ledger
sudo systemctl status trucking-ledger
```

## Troubleshooting

- `MAPBOX_ACCESS_TOKEN is not configured`: set `MAPBOX_ACCESS_TOKEN` in `backend/.env` or the container environment.
- Map is blank in the browser: set `VITE_MAPBOX_TOKEN` before running the frontend or before building production assets.
- `DisallowedHost`: add the domain to `DJANGO_ALLOWED_HOSTS`.
- Browser CORS errors in split-origin development: add the frontend origin to `CORS_ALLOWED_ORIGINS`.
- React app loads but assets 404: rebuild frontend and run `collectstatic`.
- Nginx returns 502: check `systemctl status trucking-ledger` or confirm the Docker container is listening on `127.0.0.1:8000`.

## HOS Assumptions And Limitations

- The app uses the provided `current_cycle_used` as the starting 70-hour cycle value.
- It does not reconstruct the previous 8 days of logs, so natural rolling-hour drop-offs are not calculated.
- When cycle time is exhausted, the app schedules a conservative 34-hour restart before more driving.
- Required 10-hour rest breaks are modeled as 1.5 hours off duty followed by 8.5 hours in the sleeper berth.
- Driver daily log metadata fields are left blank for the user to complete on printout.
- Stop remarks use reverse-geocoded city/state when available and route-mile fallback labels otherwise.
- Turn-by-turn route instructions are not currently displayed, but they can be added from the routing provider response if needed.

## Submission Checklist

- Hosted URL is reachable
- `/api/health/` returns `200`
- `npm run verify` passes locally
- Short-trip and long-trip smoke checks pass
- Mapbox tokens are configured for backend and frontend
- Mobile layout is usable
- Browser console has no blocking errors
- GitHub repository is accessible to reviewers
- Loom video covers the app flow, generated logs, backend HOS logic, and assumptions

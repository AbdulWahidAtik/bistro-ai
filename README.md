# Bistro AI

Bistro AI is a restaurant operations portal for managing AI voice-agent behavior, menu knowledge, call scripts, settings, and activity telemetry.

## Current Features

- Operations dashboard with backend analytics, manual refresh, activity feed, report download, and simulated live monitor.
- Menu management with create/edit/delete, status toggles, category filters, pagination, CSV import, and AI-style description drafting.
- Script library with create/edit/delete, transcript preview, dialogue playback simulation, copy, and download.
- Operations workspace for reservations and orders with create/edit/delete, status updates, itemized order totals, and backend sync.
- Settings for restaurant identity, voice profile, routing number, conversation rules, SMS toggle, service hours, and admin-only access management.
- Optional role-based login with admin/manager/staff permissions, bearer-token protected write endpoints, and frontend logout/session-expiry handling.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Gemini SDK dependency prepared for AI generation
- Express backend with MongoDB persistence when `MONGODB_URI` is configured
- Production security headers and single-service smoke testing

## Run Locally

Prerequisites: Node.js 20+ recommended.

```bash
npm install
cp .env.example .env
npm run dev
```

The frontend dev server runs on `http://localhost:3000`.

For backend-backed data, run the API in a second terminal:

```bash
npm run dev:api
```

The Vite dev server proxies `/api/*` requests to `http://localhost:3001`.

## Useful Commands

```bash
npm run dev
npm run dev:api
npm run start
npm run build
npm run lint
npm test
npm run test:ui
npm run preview
npm run clean
npm run seed:demo
npm run smoke:prod
```

## Quality Checks

Run the same checks used by CI:

```bash
npm run lint
npm test
npm run test:ui
npm run build
npm run smoke:prod
```

GitHub Actions is configured in `.github/workflows/ci.yml` to run these checks on pushes to `main`/`master` and on pull requests.

## Demo Seed

Create a fresh demo workspace and three role-based accounts:

```bash
npm run seed:demo
```

Default demo credentials:

- Admin: `admin` / `AdminPass123!`
- Manager: `manager` / `ManagerPass123!`
- Staff: `staff` / `StaffPass123!`

The script uses `MONGODB_URI` when it is configured; otherwise it writes to the JSON fallback store. Passwords are stored as `scrypt` hashes. Override the credentials with `DEMO_ADMIN_*`, `DEMO_MANAGER_*`, and `DEMO_STAFF_*` environment variables.

## Backend API

Run the standalone API server:

```bash
npm run dev:api
```

The API runs on `http://localhost:3001` by default. Set `MONGODB_URI` to use MongoDB; when it is empty, the API keeps using the local JSON fallback at `data/bistro-ai.json`. This makes local development work without a database, while production can use MongoDB Atlas or a managed MongoDB instance.

For single-service deployment, build the frontend and set `SERVE_STATIC=true` before starting the API:

```bash
npm run build
npm run start
```

With `SERVE_STATIC=true`, Express serves the built frontend from `dist/` and still handles `/api/*` routes from the same process.

After building, verify the single-service production mode:

```bash
npm run build
npm run smoke:prod
```

The smoke test starts Express with `SERVE_STATIC=true`, checks `/api/health`, verifies the built frontend is served, logs in as the bootstrap admin, and reads the admin-only users endpoint.
It also checks baseline production security headers including CSP, `X-Content-Type-Options`, and disabled `X-Powered-By`.

Implemented endpoints:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/ai/menu-description`
- `POST /api/ai/script`
- `GET /api/bootstrap`
- `GET /api/analytics/overview`
- `GET /api/reports/operations`
- `GET /api/workspace/export`
- `POST /api/workspace/import`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/menu-items`
- `POST /api/menu-items`
- `PUT /api/menu-items/:id`
- `DELETE /api/menu-items/:id`
- `GET /api/scripts`
- `POST /api/scripts`
- `PUT /api/scripts/:id`
- `DELETE /api/scripts/:id`
- `GET /api/activity-logs`
- `POST /api/activity-logs`
- `GET /api/reservations`
- `POST /api/reservations`
- `PUT /api/reservations/:id`
- `DELETE /api/reservations/:id`
- `GET /api/orders`
- `POST /api/orders`
- `PUT /api/orders/:id`
- `DELETE /api/orders/:id`
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/reset`

## Environment

Create `.env` from `.env.example` and set:

- `GEMINI_API_KEY`: enables real Gemini AI generation. Leave empty to use backend fallback text.
- `GEMINI_MODEL`: Gemini text model used by backend AI generation.
- `APP_URL`: app URL for deployed links and callbacks.
- `CORS_ORIGINS`: comma-separated browser origins allowed to call the API. Defaults to `APP_URL`.
- `API_PORT`: backend API port.
- `SERVE_STATIC`: serves `dist/` through Express when set to `true`.
- `REQUEST_LOGGING`: enables JSON request logs unless set to `false`.
- `RATE_LIMIT_ENABLED`: enables in-memory rate limiting unless set to `false`.
- `RATE_LIMIT_WINDOW_MS`: rate-limit window size in milliseconds.
- `RATE_LIMIT_MAX`: general `/api/*` requests per window per client.
- `AUTH_RATE_LIMIT_MAX`: `/api/auth/login` requests per window per client.
- `AI_RATE_LIMIT_MAX`: `/api/ai/*` requests per window per client.
- `ADMIN_USERNAME`: bootstrap admin login username. Defaults to `admin`.
- `ADMIN_PASSWORD`: enables backend auth and creates the first admin account when set. Leave empty for local open mode.
- `AUTH_SECRET`: secret used to sign API auth tokens.
- `AUTH_TOKEN_TTL_MS`: token lifetime in milliseconds.
- `DEMO_ADMIN_USERNAME`, `DEMO_ADMIN_PASSWORD`: admin account used by `npm run seed:demo`.
- `DEMO_MANAGER_USERNAME`, `DEMO_MANAGER_PASSWORD`: manager account used by `npm run seed:demo`.
- `DEMO_STAFF_USERNAME`, `DEMO_STAFF_PASSWORD`: staff account used by `npm run seed:demo`.
- `MONGODB_URI`: MongoDB connection string for local MongoDB or MongoDB Atlas.
- `DATA_FILE`: local JSON fallback store path when `MONGODB_URI` is empty.

When `ADMIN_PASSWORD` is set, protected endpoints require `Authorization: Bearer <token>`. Get a token with `POST /api/auth/login`.
The first admin account is bootstrapped from `ADMIN_USERNAME` and `ADMIN_PASSWORD`; additional admin, manager, and staff accounts are managed from Settings > Access.
Admins can manage users, settings, backups, menu, scripts, AI generation, reservations, and orders. Managers can manage menu, scripts, AI generation, reservations, and orders. Staff can manage reservations, orders, and activity logs.
The frontend automatically shows a sign-in screen when backend auth is enabled. It stores the token/session in localStorage, clears it on logout, and redirects back to login if the API returns `401`.

## Backups

Export the full workspace as JSON:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/workspace/export
```

Restore a backup:

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  --data @bistro-ai-workspace-backup.json \
  http://localhost:3001/api/workspace/import
```

When auth is disabled in local dev, the authorization header is not required. In protected deployments, both endpoints require an admin bearer token.

### MongoDB Setup

Local MongoDB example:

```bash
MONGODB_URI="mongodb://127.0.0.1:27017/bistro-ai"
```

MongoDB Atlas example:

```bash
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster.mongodb.net/bistro-ai"
```

Keep `MONGODB_URI` empty to use the JSON fallback store.

### Auth Setup

For local open mode:

```bash
ADMIN_PASSWORD=""
```

For protected mode:

```bash
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="use-a-strong-password"
AUTH_SECRET="use-a-long-random-secret-at-least-32-chars"
```

### Gemini Setup

Add a Gemini API key to enable real backend generation for menu descriptions and scripts:

```bash
GEMINI_API_KEY="your-key"
GEMINI_MODEL="gemini-2.0-flash"
```

## Production Checklist

- Run `npm run build`, `npm test`, `npm run test:ui`, and `npm run lint`.
- Run `npm run smoke:prod` after building.
- Set `ADMIN_PASSWORD` and a long random `AUTH_SECRET`.
- Ensure `AUTH_SECRET` is at least 32 characters and not the same as `ADMIN_PASSWORD` in production.
- Set `CORS_ORIGINS` to the exact deployed frontend origin.
- Set `MONGODB_URI` for durable production data.
- Set `GEMINI_API_KEY` if real AI generation should be enabled.
- Set `APP_URL` to the deployed frontend URL.
- Set `SERVE_STATIC=true` when one Express service should serve both frontend and API.
- Keep `REQUEST_LOGGING=true` unless your hosting platform already captures equivalent request logs.
- Tune rate limits for the deployment size and place stronger limits in front of public deployments.
- Keep `.env` out of source control.
- Confirm production responses include security headers by running `npm run smoke:prod`.

## Docker

Build and run a single-container deployment:

```bash
docker build -t bistro-ai .
docker run --env-file .env -p 3001:3001 bistro-ai
```

The container defaults to `SERVE_STATIC=true`, so `http://localhost:3001` serves the built frontend and `/api/*` serves the backend API.
The runtime image also includes the `scripts/` directory, so `npm run seed:demo` and `npm run smoke:prod` are available inside the container when needed.

## Completion Roadmap

See [ROADMAP.md](./ROADMAP.md) for the implementation plan.

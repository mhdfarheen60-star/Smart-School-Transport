# Smart School Transportation Management System

Full-stack web application that connects **students**, **drivers** and **school administrators** to manage
transport requests, bus assignments, routes, daily pickup/drop-off attendance, notifications, complaints and
vehicle problem reports.

**Developer:** Muhammed Farheen P K

| Layer    | Stack |
|----------|-------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide, React Router, Axios, Recharts |
| Backend  | Node.js, Express, TypeScript, JWT, bcrypt-hashed passwords (`bcryptjs`), Zod validation |
| Database | MongoDB via Mongoose (local, Compass or Atlas) |

## Project structure

```
smart-school-transport/
├── backend/    Express REST API (models, controllers, routes, middleware, services, validators)
├── frontend/   React app (layouts, pages/{auth,student,driver,admin}, components, services, context)
├── package.json  convenience scripts
└── README.md
```

## Prerequisites

* Node.js 18+
* A MongoDB instance: local `mongod`, or a MongoDB Atlas connection string

## Setup

```bash
# 1. install dependencies
npm run install:all            # or: npm install in backend/ and frontend/

# 2. configure the backend
cp backend/.env.example backend/.env
#    edit backend/.env: set MONGO_URI, JWT_SECRET (long random string),
#    SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD

# 3. configure the frontend
cp frontend/.env.example frontend/.env     # VITE_API_URL=http://localhost:5000/api

# 4. create the first administrator (add --demo for sample drivers/buses/routes)
npm run seed --prefix backend -- --demo
```

### Environment variables

`backend/.env`

| Name | Purpose |
|------|---------|
| `PORT` | API port (default 5000) |
| `MONGO_URI` | MongoDB connection string (local or Atlas) |
| `JWT_SECRET` | Secret for signing tokens (min 16 chars; use a long random value) |
| `CLIENT_URL` | Allowed CORS origin(s), comma separated (default `http://localhost:5173`) |
| `NODE_ENV` | `development` / `production` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Used only by `npm run seed` |

`frontend/.env` — `VITE_API_URL=http://localhost:5000/api`

> `.env` files are git-ignored. Never commit real credentials.

## Running

```bash
# terminal 1 — API on http://localhost:5000/api
npm run dev --prefix backend

# terminal 2 — UI on http://localhost:5173
npm run dev --prefix frontend
```

Production build: `npm run build` (compiles `backend/dist` and `frontend/dist`); start the API with
`npm start --prefix backend`.

### Logging in

| Role | URL | Account |
|------|-----|---------|
| Student | `/login`, `/register` | self-registration |
| Driver | `/driver/login` | created by an admin (Admin → Drivers) |
| Admin | `/admin/login` | created by `npm run seed` |

With `--demo`, two drivers (`ravi.driver@school.local`, `suresh.driver@school.local`), two buses and two routes
are created; their password is `SEED_DEMO_PASSWORD` or, if unset, `SEED_ADMIN_PASSWORD`.

## Google Maps location selection

Students pick exact pickup / drop-off points on a Google map; drivers and admins see them on maps and can open them in Google Maps.

1. In Google Cloud, create a **browser** API key and enable only: **Maps JavaScript API**, **Places API (New)** and **Geocoding API**.
2. Restrict the key to your site domains (HTTP referrers) and to those three APIs.
3. Put it in `frontend/.env` as `VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key` and restart `npm run dev`.

Without a key the app still runs: the picker shows a configuration notice and lets students type the address and
coordinates manually; maps are replaced by a coordinate list plus working Google Maps links.

How it works

* `POST /api/transport-requests` takes `pickupLocation` / `dropLocation` as `{ address, latitude, longitude, placeId? }`
  (validated: address required, latitude -90..90, longitude -180..180). The address is stored in the existing
  `pickupLocation` / `dropLocation` string fields and the coordinates in new `pickupGeo` / `dropGeo` fields, so older
  requests keep working. Responses add `pickup` / `drop` objects. `PATCH /api/transport-requests/:id` edits a pending request.
* Changes after approval go through `/api/location-changes` (student submit, admin approve/reject). Nothing live changes
  until approval; on approval the request's location is updated, the student and the assigned driver are notified, and
  the previous/proposed values, requester, reviewer and timestamps are kept as history.
* Drivers receive student locations only for their own active assignment (`GET /api/assignments/mine`); every check is
  enforced on the backend.

## Feature overview

**Student** — registration, transport request, assigned bus/driver/route/pickup time, notifications,
pickup/drop attendance history, complaints, profile.

**Driver** — dashboard, assigned students, daily trip with pickup (picked up / absent / not available) and
drop-off marking, stop-by-stop route, vehicle problem reporting (breakdown, traffic delay, accident,
mechanical issue), notifications, profile.

**Admin** — dashboard + charts, CRUD for students/drivers/vehicles/routes, request approval with bus assignment,
bus/driver/route assignments with capacity and conflict validation, trips, attendance monitoring and correction,
complaint and vehicle-problem management (including marking a vehicle unavailable), broadcast notifications,
reports with CSV/PDF export, audit log.

### Business rules enforced by the API

* Duplicate student IDs, emails, licence numbers and vehicle registration numbers are rejected (unique indexes + checks).
* A vehicle or driver can have only one active assignment (partial unique indexes).
* Vehicle capacity is validated whenever a student is added or capacity is lowered; unavailable vehicles cannot be assigned.
* Trips and attendance store their own vehicle/driver/route references, so ending or changing an assignment
  never rewrites history. Students/drivers/vehicles/routes with history are deactivated or refuse deletion instead of being removed.
* A student cannot be dropped before being picked up; closed trips cannot be edited by drivers.
* Every list endpoint supports `page`, `limit`, `search`, `sort` (`field` / `-field`) and entity filters.

## API summary

All responses: `{ success, data, meta? }` or `{ success: false, message, details? }`. Send `Authorization: Bearer <token>`.

| Prefix | Notes |
|--------|-------|
| `/api/auth` | `POST register`, `POST login`, `GET me`, `PATCH profile`, `POST change-password` |
| `/api/students`, `/drivers`, `/vehicles`, `/routes` | admin CRUD (`GET /routes/options` for any signed-in user) |
| `/api/transport-requests` | student create/list/cancel; admin list + `PATCH :id/review` |
| `/api/assignments` | admin CRUD, `POST :id/end`, `POST :id/riders`, `DELETE :id/riders/:studentId`; `GET mine` (student/driver) |
| `/api/trips` | driver `POST today`; admin create/list; `PATCH :id/status` |
| `/api/attendance` | role-scoped list; driver `PATCH :id/pickup`, `PATCH :id/drop`; admin `PATCH :id` |
| `/api/notifications` | own list, mark read/all read, delete; admin broadcast `POST` |
| `/api/complaints` | student/driver create, role-scoped list, admin `PATCH :id` |
| `/api/vehicle-problems` | driver create/list, admin list + `PATCH :id` |
| `/api/reports/:type` | admin; `?from&to&format=json\|csv\|pdf`; types: students, drivers, vehicles, attendance, requests, complaints, vehicle-problems |
| `/api/dashboard` | `admin`, `student`, `driver`, `audit-logs` |

## Testing

With MongoDB and the API running and the admin seeded:

```bash
npm run test:e2e --prefix backend
```

The script exercises registration/login, role permissions, CRUD, all six workflows (request → approval →
assignment → pickup/drop → problem report → complaint → report export), capacity and conflict rules, and
error handling against the real API and database.

## Security notes

* Passwords hashed with bcrypt (cost 12); login errors never reveal whether an email exists.
* JWT (7 days) verified on every request, and the user must still exist and be active.
* Role-based middleware on every route; students/drivers only ever receive their own records.
* Input validated with Zod; Helmet headers, CORS allow-list, request body size limit, auth rate limiting.
* CSV exports neutralise spreadsheet-formula injection.
* Set a strong `JWT_SECRET` and use HTTPS in production.

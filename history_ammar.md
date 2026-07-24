# Frontend History — apks-react (React + Vite + MapLibre GL JS)

## Date: 2026-07-25

### Summary of Changes

---

### Session 4 — Team Management + Empty Dropdown Fix (Latest)

**Problem:** Team dropdown on the User form was empty. Backend treated NULL `is_active`/`is_deleted` on legacy `tbl_team` rows as "not active/deleted", excluding all existing teams. No UI existed to manage teams.

**Added:** Full Team Management admin page with CRUD, plus a new teams API client.

- **Team Management page** (`/teams`) — admin-only table + create/edit modal
- **Sidebar** shows "Team Management" link for admin only
- `/auth/me` now includes team details (`team` object + `id_team`)

**Files changed:**
- `src/api/teams.js` — **NEW**. `teamApi` client (list, get, create, update, delete)
- `src/pages/AdminTeams.jsx` — **NEW**. Team management page: table (name, BA, zone, leader, status) + create/edit modal (name, BA, zone, leader dropdown, active toggle) + delete
- `src/App.jsx` — Added `/teams` route
- `src/components/layout/Sidebar.jsx` — Added "Team Management" nav link (admin only)

---

## Date: 2026-07-22

### Summary of Changes

---

### Session 3 — Form Replication (Latest)

- **All 5 survey forms rebuilt** to exactly match the old Laravel app fields
- **SAVR (Tiang)** — 6-step wizard: Info, Images, Daftar Aset (span radios), Kejanggalan (11 defect checkbox groups), Height Clearance, Kebocoran Arus (current leakage + cleanup images)
- **Substation** — single page: general info, gate status (radio+checkbox), building defects, 17 image upload fields
- **Feeder Pillar** — single page: gate status, 7 defect selects, 13 image upload fields
- **Link Box** — single page: 8 defect selects, 15 image upload fields
- **Cable Bridge** — single page: 10 defect selects, 13 image upload fields
- **New field types in FormField.jsx**: `radio` (button groups), `defect-group` (checkboxes with "other" text), `span-group` (radio 1-6 + other value per sub-field), `image` (file upload with preview), `time`
- **SurveyForm.jsx** rewritten to support wizard steps + image file upload (files separated from JSON data, uploaded via `/surveys/{type}/{id}/images`)
- **surveyConfigs.js** completely rewritten with exact field names, labels, dropdown options, and image field names matching the old app

---

### Session 2

- **Login** accepts email **OR name** (not just email)
- **Register page** (`/register`) — self-registration with BA dropdown
- **Admin Users page** (`/users`) — full CRUD: create, edit, delete, role multi-select, active toggle
- **Sidebar** shows "User Management" link for admin/manager only
- **API layer** — added `authApi.register()`, `userApi` (list, create, update, delete, assignRoles, listBAs, listRoles)

---

### Initial Build (Session 1)

---

### 1. Project Scaffolding

**Created from scratch:** React 18 + Vite + TailwindCSS + MapLibre GL JS

**Tech stack:**
- React 18.3, React Router 6
- Vite 5.4 with proxy to FastAPI backend
- TailwindCSS 3.4
- MapLibre GL JS 4.5 (vector tiles)
- Axios (API client with JWT interceptors)

**Key config files:**
- `package.json` — Dependencies
- `vite.config.js` — Vite config with proxy to `localhost:8070` and code splitting
- `tailwind.config.js` — Custom primary color palette
- `postcss.config.js` — Tailwind + Autoprefixer
- `.env` — API URLs (uses relative paths through Vite proxy)

---

### 2. API Layer

| File | Purpose |
|---|---|
| `src/api/client.js` | Axios instance with JWT Bearer token injection + automatic token refresh on 401 |
| `src/api/auth.js` | `login(identifier, password)`, `register()`, `logout()`, `me()` |
| `src/api/surveys.js` | CRUD for all survey types, image upload, tile URL builder, dashboard, drop-point |
| `src/api/users.js` | User management CRUD, BA list, roles list |

---

### 3. Authentication System

| File | Purpose |
|---|---|
| `src/context/AuthContext.jsx` | Auth provider with `user`, `login`, `logout`, `hasRole`, `loading` |
| `src/components/auth/ProtectedRoute.jsx` | Redirects to `/login` if no user; shows spinner during loading |
| `src/pages/Login.jsx` | Login form accepting **email OR name** + "Sign up" link |
| `src/pages/Register.jsx` | Self-registration with BA dropdown (from `/users/bas`) |

**Auth flow:**
1. Login accepts email or name
2. JWT stored in `localStorage` (`access_token` + `refresh_token`)
3. Axios interceptor auto-refreshes on 401
4. `ProtectedRoute` gates all app routes

---

### 4. Layout & Navigation

| File | Purpose |
|---|---|
| `src/components/layout/Layout.jsx` | Shell: Sidebar + main content area |
| `src/components/layout/Sidebar.jsx` | Nav links for Dashboard, 5 survey types, Map, **User Management** (admin/manager only) |
| `src/components/layout/Header.jsx` | Page header with title, subtitle, mobile menu toggle |

---

### 5. Survey Module (Config-Driven)

**Core concept:** All 5 survey types are driven by a single config file.

| File | Purpose |
|---|---|
| `src/config/surveyConfigs.js` | Defines all 5 survey types: columns, form fields, filters, sections |
| `src/components/surveys/SurveyModule.jsx` | Generic CRUD container: table + filters + map + create/edit/detail views |
| `src/components/surveys/SurveyForm.jsx` | Dynamic form renderer with tabbed Form/Map interface |
| `src/components/surveys/SurveyDetail.jsx` | Read-only detail with map, images, QA actions |
| `src/pages/surveys/SurveyPage.jsx` | Thin wrapper that passes survey key to module |

**Survey types configured:**

| Key | Title | Endpoint | Icon |
|---|---|---|---|
| `savr` | SAVR | `/surveys/savr` | utility pole |
| `substation` | Substation | `/surveys/substation` | building |
| `feeder_pillar` | Feeder Pillar | `/surveys/feeder-pillar` | box |
| `link_box` | Link Box | `/surveys/link-box` | link |
| `cable_bridge` | Cable Bridge | `/surveys/cable-bridge` | bridge |

Each config includes: `title`, `subtitle`, `endpoint`, `tableName`, `color`, `columns` (table display), `sections` (form fields), `filters`.

---

### 6. Map Module (MapLibre GL JS)

| File | Purpose |
|---|---|
| `src/components/map/MapView.jsx` | Reusable map component with vector tile overlays |
| `src/pages/MapOverview.jsx` | Full-screen map with all survey types, filterable |

**MapView features:**
- **Vector tiles** from FastAPI `/tiles/survey/{z}/{x}/{y}.pbf`, `/tiles/ba/`, `/tiles/roads/`
- **QA status color-coding:** green=accepted, yellow=pending, red=rejected, gray=unsurveyed
- **Click-to-drop** points for creating records (sets lat/lng)
- **Click popups** for viewing existing point details
- **Base layer toggle:** Satellite (Esri) / Street (OSM)
- **Layer toggles:** Survey points, BA boundaries, Roads
- **Legend** with collapsible status colors

**Map appears in:**
- Each survey page (side panel, 480px wide)
- Survey form (tabbed "Map Location" panel)
- Survey detail (top section)
- `/map` overview page (full screen)

---

### 7. Admin User Management

| File | Purpose |
|---|---|
| `src/pages/AdminUsers.jsx` | Full CRUD table for users: create, edit, delete, assign roles, toggle active |
| `src/components/ui/Modal.jsx` | Reusable modal for create/edit forms |

**Features:**
- Table with name, email, BA, zone, roles, status
- Create modal: name, email, password, BA dropdown, zone, role multi-select
- Edit modal: same fields (password optional), active/inactive toggle
- Role selector: admin, manager, qc_officer, team_leader, surveyor, viewer
- Only visible to admin/manager roles (sidebar link conditional)

---

### 8. Dashboard

| File | Purpose |
|---|---|
| `src/pages/Dashboard.jsx` | Summary cards + survey type cards |

**Features:**
- Summary counts from `/dashboard/summary` (total, pending, accepted, rejected)
- 5 survey type cards with icon, title, subtitle, counts
- Click any card → navigate to that survey's page

---

### 9. Reusable UI Components

| File | Purpose |
|---|---|
| `src/components/ui/StatusBadge.jsx` | Colored QA status badge |
| `src/components/ui/Pagination.jsx` | Page navigation |
| `src/components/ui/FormField.jsx` | Dynamic field renderer (text, date, select, json, checkbox, textarea) |
| `src/components/ui/Modal.jsx` | Overlay modal with size variants |

---

### 10. Routing

All routes defined in `src/App.jsx`:

| Route | Component | Auth |
|---|---|---|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/` | Dashboard | Protected |
| `/map` | MapOverview | Protected |
| `/users` | AdminUsers | Protected (admin/manager) |
| `/savr` | SurveyPage | Protected |
| `/substation` | SurveyPage | Protected |
| `/feeder_pillar` | SurveyPage | Protected |
| `/link_box` | SurveyPage | Protected |
| `/cable_bridge` | SurveyPage | Protected |

---

### 11. API Proxy Configuration

`vite.config.js` proxies `/api` to `http://localhost:8070` — eliminates CORS issues during development. `.env` uses relative URLs (`/api/v1`) so all requests go through the proxy.

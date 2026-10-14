# WareWise XR — Full Stack Local Training Prototype (v7)

WareWise XR is a browser-based 3D warehouse safety-training prototype for the CET257 Enterprise Project. This build combines the existing interactive warehouse with a localhost employee-access system, administrator approval workflow, account-linked progress and an employee leaderboard.

## Quick start

### Windows
Double-click `START_WINDOWS.bat`.

### macOS / Linux
Run:

```bash
./START_MAC_LINUX.sh
```

### Manual start
Node.js 18+ is required. There are **no npm packages to install**.

```bash
node server.js
```

Then open:

`http://127.0.0.1:8080`

Do not open the HTML files directly with `file://`; authentication and progress APIs require the local Node server.

## Default administrator account

- Email: `admin@warewise.local`
- Password: `Admin123!`

This is a local academic prototype credential. For a demonstration, the defaults are intentionally easy to find. You can override them **before the first run** with environment variables:

- `WAREWISE_ADMIN_EMAIL`
- `WAREWISE_ADMIN_PASSWORD`
- `PORT`

Example:

```bash
WAREWISE_ADMIN_PASSWORD="ChangeMeForDemo!" node server.js
```

## Employee access flow

1. Open the landing page.
2. Choose **Employee → Request access**.
3. Enter name, work email, department and a password.
4. The employee may sign in immediately, but the training button remains locked while the request is **Pending**.
5. Sign in as the administrator.
6. Open **Access requests** and approve the employee.
7. The employee can now enter `/training` and use the full 3D WareWise XR environment.

The server also checks this status directly. Typing `/training` into the address bar does not bypass approval.

## Administrator console

The admin console intentionally uses a simple operational design. It shows:

- pending access requests;
- approve/reject controls;
- approved/rejected employee accounts;
- best score and completion percentage;
- number of training attempts;
- last training activity;
- verified employee leaderboard.

## Employee dashboard

Approved employees can see:

- access status;
- start/continue training button;
- best score;
- best completion;
- attempt count;
- last activity;
- current six-module completion state;
- server-backed employee leaderboard.

Pending or rejected employees can sign in to view their status but cannot open the warehouse.

## Training progress and leaderboard

The original warehouse state is still used by the 3D simulation, but it is loaded from and synced to the logged-in employee account. The backend stores:

- current score and module state;
- reported hazards and unsafe acts;
- current completion;
- historical best score;
- historical best completion;
- attempts and last-played time.

`Reset warehouse` restores the live 3D environment. `Reset current progress` clears the employee's active module progress, but does **not** erase their historical best leaderboard result.

The leaderboard includes approved employees who have started at least one training attempt and ranks them by best score, then best completion.

## Local backend

The backend is implemented in `server.js` using only Node.js built-in modules:

- `http` for the local web/API server;
- `crypto.scrypt` for password hashing;
- HTTP-only, SameSite session cookies;
- a local JSON store at `data/store.json`.

No external API, hosted authentication service, npm dependency or cloud database is needed.

`data/store.json` is generated automatically on first launch and persists local accounts, approvals and progress between server restarts.

## Main routes

- `/` — secure employee/admin sign-in and access request page
- `/employee` — employee dashboard
- `/admin` — administrator console
- `/training` — protected 3D warehouse, approved employees only

## Existing 3D training retained

The v6 training features are preserved, including:

- Manual Handling
- Working at Height
- Hazard Perception
- Unsafe Acts
- 5 Whys / root-cause analysis
- Cyber Awareness
- pick-up / carry / drop interactions
- 360-degree first-person movement
- warehouse collisions
- minimap and objective compass
- training control room and station signage
- Esc-close quiz/modal behaviour
- warehouse reset
- timed two-player Hazard Hunt mode
- WebXR pathway for compatible hardware

## Project structure

```text
WareWiseXR_Final_FullStack_v7/
├── index.html              secure sign-in / request access
├── employee.html           employee dashboard
├── admin.html              administrator dashboard
├── training.html           protected 3D training frontend
├── server.js               localhost backend/API/static server
├── package.json            dependency-free Node start command
├── assets/                 WareWise SVG brand assets
├── css/
│   ├── portal.css          login/employee/admin styling
│   └── app.css             existing 3D training UI styling
├── js/
│   ├── auth.js             login / request access frontend
│   ├── employee.js         employee account dashboard
│   ├── admin.js            approval / monitoring dashboard
│   ├── training-loader.js  auth guard + server progress loading
│   ├── math3d.js
│   ├── engine.js
│   ├── training.js
│   └── app.js
└── data/
    └── store.json          generated on first run
```

## Scope / security note

This is an academic localhost prototype, not a production identity platform. Passwords are hashed and training access is server-checked, but a real enterprise deployment would additionally require central identity/SSO, TLS, formal role administration, audit retention, backup/recovery, hardened database storage, rate limiting, password recovery and organisational security review.

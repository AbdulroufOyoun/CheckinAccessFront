# CheckinAccess Front

Angular tenant-admin SPA for **CheckinAccess**.

**Full stack install, Reverb, and deployment:** [`../README.md`](../README.md)

Use this app against a **tenant domain** API (example: `http://ratco.localhost:8000/api/admins/...`).
Platform owners should use **CheckinAccessPlatform** against the central API instead.

## Stack

- Angular 21 (standalone)
- Bootstrap 5 + ng-bootstrap (primary UI)
- ngx-translate (AR / EN + RTL)
- Auth: login → OTP → Passport Bearer (`admin-api`)

## Prerequisites

| Tool | Notes |
|------|--------|
| Node.js | 20+ recommended |
| npm | Comes with Node |
| Backend | [CheckinAccess](https://github.com/AbdulroufOyoun/CheckinAccess) HTTP API on port **8000** |
| Reverb | Same backend: `php artisan reverb:start` on port **8081** (required for live room occupancy; 8080 is Herd nginx). See [`../README.md`](../README.md#realtime-laravel-reverb--setup--verify). |
| Hosts | `127.0.0.1 ratco.localhost` (or your tenant domain) |

## First-time install

```bash
git clone https://github.com/AbdulroufOyoun/CheckinAccessFront.git
cd CheckinAccessFront
npm install
```

API base URL is derived from the browser hostname in `src/app/apiEndpoints.ts`:

- Opening `http://localhost:4200` → API host `http://ratco.localhost:8000`
- Opening `http://ratco.localhost:4200` → API host `http://ratco.localhost:8000`

Make sure the Laravel backend accepts that host. Run **both** of these from `CheckinAccess` (two terminals):

```bash
cd ../CheckinAccess
php artisan serve --host=0.0.0.0 --port=8000
```

```bash
cd ../CheckinAccess
php artisan reverb:start
```

Without Reverb, the admin UI still loads, but dashboard / room status / booking room pickers will not update live.

## How to run

Keep the backend API **and** Reverb running first, then:

```bash
npm start
# equivalent:
# npx ng serve --host=0.0.0.0 --port=4200
```

Open:

- http://localhost:4200/  
  or  
- http://ratco.localhost:4200/ (preferred for multi-tenant hostname testing)

Login with a **tenant admin** created from the platform / backend seed flow. In local/dev, OTP is returned as `data.sms` from the login API.

### Windows PowerShell note

If `ng` fails with an execution-policy error, use:

```powershell
npm.cmd start
```

## Build for production

```bash
npm run build
```

Output is under `dist/`.

## Tests

```bash
npm test
```

## Related projects

| Project | Purpose |
|---------|---------|
| CheckinAccess | Laravel multi-tenant API |
| CheckinAccessPlatform | Central platform console (`/api/users`, `/api/tenants`) |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS / network failed | Backend must listen on `0.0.0.0:8000` and tenant host must resolve |
| Login 403 / wrong tenant | Use matching tenant domain; do not hit central host for admin APIs |
| Empty menus | Admin permissions / tenant modules (`property`, `education`) |
| Room occupancy not updating live | Start Reverb in the backend repo: `php artisan reverb:start` |

## License

MIT

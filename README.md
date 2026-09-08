# OnePost Backend (Express.js API)

Standalone Express 5 API server for OnePost.

## Setup
```bash
npm install
cp .env.example .env   # DATABASE_URL + Firebase Admin credentials
npm run db:push        # create/update database tables (drizzle-kit)
npm run dev            # builds with esbuild and starts on PORT (default 8080)
```

## Scripts
- `npm run build` – bundle to `dist/`
- `npm start` – run the built server
- `npm run db:push` – push the Drizzle schema to Postgres

## Notes
- Firebase Admin SDK init: `src/lib/firebase.ts`. Auth middleware: `src/middlewares/requireAuth.ts` (verifies `Authorization: Bearer <idToken>`; falls back to a fixed preview user outside production unless `PREVIEW_MODE=false`).
- Database schema + Drizzle client: `local_modules/@workspace/db`
- Zod API validators: `local_modules/@workspace/api-zod`
- File uploads (`src/lib/objectStorage.ts`) were built for Replit App Storage; outside Replit, wire it to your own Google Cloud Storage bucket/credentials.
- Email sending (`src/lib/email.ts`) is a stub returning 501 until you plug in a provider (e.g. Resend, Gmail API).
- The scheduler (auto-publishing scheduled posts) starts automatically with the server.

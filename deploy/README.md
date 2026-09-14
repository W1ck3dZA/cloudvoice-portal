# Deploy

Builds the portal as a static bundle and serves it with nginx.

## Build & run

```sh
cd deploy
cp .env.example .env   # set VITE_API_URL if not using the default
docker compose up -d --build
```

The app is served on `http://localhost:8080`.

## Notes

- `VITE_API_URL` is a **build-time** value — Vite inlines it into the JS bundle. Changing it requires an image rebuild (`docker compose up -d --build`), not just a container restart.
- The compose file expects an external `local-bridge` Docker network (`docker network create local-bridge` if it doesn't exist yet).
- nginx serves `/assets/*` with long-lived cache headers (filenames are content-hashed by Vite) and falls back everything else to `index.html` for client-side routing.

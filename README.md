# Cloudvoice Customer Portal

React + TypeScript customer portal for the Cloudvoice REST API.

## v0.2.0

This release expands the original portal into a full management UI around the supplied OpenAPI 3.0.3 specification.

### Included

- JWT login and self-registration
- Responsive desktop/mobile application shell
- Numbers: list, view, create, edit, release, capability/application assignment
- SIP Users: list, view, create, edit, delete, password rotation with one-time secret display
- SIP Gateways: list, view, create, edit, delete and gateway test
- Calls: list, detailed view, active-call hangup and full outbound origination form
  - phone, SIP URI and registered-user destinations
  - SIP digest auth and outbound proxy
  - caller identity / From host
  - application attachment, recording, timeouts and early-media options
  - custom SIP headers, metadata tags and AMD tuning
- Recordings: list, playback, authenticated download and delete
- Applications: list, create, edit, delete and version-aware flow editing
- Visual Flow Builder for all application verbs
  - play
  - gather
  - dial
  - listen
  - pause
  - say
  - hangup
  - queue
  - nested DTMF branches
  - gather default flows
  - queue answered / timeout / abandoned subflows
  - node inspector, reorder, drag reorder and branch breadcrumbs
- Call Center
  - queue CRUD
  - agent CRUD
  - live agent status changes
  - queue stats
  - live queue members
  - tier assignment create/update/delete
- SMS
  - message history/detail
  - send message
  - SMS credential create/edit/delete
- Developers
  - webhook CRUD
  - webhook signing-secret rotation
  - delivery history and failed-delivery retry
  - API key create/view/revoke
  - API key rate limits
  - custom event publisher
- Organisation
  - organisation details/edit/delete
  - member add/role update/remove
  - owner rate limits
  - ownership transfer
- User profile editing and password changes
- Light/dark theme support inherited from the existing UI theme
- Central API response normalization for inconsistent list envelopes

## Running locally

```bash
cp .env.example .env
npm install
npm run dev
```

The default API endpoint is:

```env
VITE_API_URL=https://api.cloudvoice.network
```

## Production build

```bash
npm run build
npm run preview
```

## Important API behaviour

The application authenticates interactive users with the JWT returned by `/v1/auth/login` or `/v1/auth/register`. API keys are created and managed in the Developer section, not used as browser session credentials.

The API does not use one uniform list response shape. Most resources return `data: []`, while calls return `data: { total, calls: [] }`. `src/lib/api.ts` normalizes these shapes before they reach page components.

## OpenAPI source

The supplied API specification is included at `spec/openapi.json` for development reference.

## Validation note

All TypeScript/TSX source files have been parsed with the TypeScript compiler API and pass syntax diagnostics. A dependency-backed `npm run build` could not be completed in the packaging environment because `npm install` exceeded the available network execution window. Run `npm install && npm run build` in your normal development environment before deployment.

# Bistro AI Completion Roadmap

## Phase 1 - Foundation

- Keep build and TypeScript checks passing.
- Clean project metadata, docs, and environment examples.
- Fix obvious text/content issues.
- Verify the existing UI on desktop and mobile.

## Phase 2 - Persistent App Data

- Add an API layer for menu items, scripts, activity logs, and settings. Done with a standalone Express API.
- Move menu/script/settings persistence from `localStorage` to backend storage. Done with local fallback behavior when the API is unavailable.
- Choose storage. Done:
  - MVP fallback: local JSON file store
  - Real backend: MongoDB via Mongoose when `MONGODB_URI` is configured

## Phase 3 - Real AI Features

- Add backend Gemini endpoints so API keys never ship to the browser. Done.
- Replace simulated menu description generation with real AI output. Done, with backend fallback text when `GEMINI_API_KEY` is empty.
- Replace quick script generation with prompt-based script creation. Done, with backend fallback text when `GEMINI_API_KEY` is empty.
- Add validation and guardrails for allergy, price, and reservation claims.

## Phase 4 - Real Operations Data

- Replace hardcoded dashboard metrics with API-driven analytics. Done, including manual refresh and local fallback.
- Record activity logs from menu changes, script changes, generated content, and future calls. Done for current admin workflows.
- Add exportable reports backed by real data. Done.
- Add reservations and orders domain APIs for real restaurant workflows. Done.
- Add reservation/order create, edit, delete, status update, and itemized order UI. Done.

## Phase 5 - Voice and Telephony

- Integrate a provider such as Twilio for incoming call webhooks.
- Add speech-to-text, AI response routing, and text-to-speech.
- Replace the simulated live monitor with real call status events.

## Phase 6 - Production Readiness

- Add authentication for restaurant admins. Done with optional bearer-token auth, login UI, logout, and 401 session handling.
- Add role-aware access if multiple staff members use the app.
- Add focused tests for CRUD flows and AI endpoints.
- Deploy frontend, backend, and database with production environment variables.

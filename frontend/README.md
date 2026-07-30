# OET LMS Frontend

## Setup
- Install deps: `npm install`
- Dev server: `npm run dev`

## Design System
- Colors and spacing come from `design-system/oet-lms/MASTER.md`.
- Fonts: Fira Sans (body) + Fira Code (mono) via `next/font` (`layout.tsx`).
- Theme tokens live in `tailwind.config.ts` and `src/app/globals.css`.

## shadcn/ui
- Config: `components.json`
- Base components in `src/components/ui/`; helpers in `src/lib/utils.ts`.
- To add a component:
  ```bash
  cd frontend
  npx shadcn@latest add <component-name>
  ```
- Tailwind plugin: `tailwindcss-animate` is already enabled.

## Auth flow (Phase 1)
- API base: `NEXT_PUBLIC_API_BASE` (see `.env.example`, defaults to http://localhost:4000).
- **Production HTTPS site + HTTP ECS API:** set `NEXT_PUBLIC_API_BASE=/api` and `API_URL=http://<ecs-ip>:4000` so the browser uses the `/api` rewrite proxy in `next.config.mjs` (fixes mixed-content errors).
- Pages: `/auth/login`, `/auth/register` use OTP (console). After OTP verify, JWT is stored in `localStorage` (`oet_token`).
- Portal: `/portal` consumes `/auth/me`, `/subscriptions/status`, `/tasks/for-user` with bearer token.

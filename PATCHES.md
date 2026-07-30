# PATCHES — exact changes to 5 existing files (non-destructive)

## 1. backend/src/database/schema.prisma
Append the entire contents of `backend/src/database/schema-cohort-additions.prisma`
to the end of schema.prisma, AND add these relations inside `model User { ... }`:

```prisma
  cohortSchedule   CohortSchedule?
  cohortSessions   CohortSessionRecord[]
  cohortDays       CohortDayProgress[]
  cohortWarnings   CohortWarning[]
  cohortReports    CohortWeeklyReport[]
```

Then run:
```bash
cd backend && npm run prisma:migrate -- --name add_cohort_layer
```
(Or apply `backend/src/database/cohort-migration.sql` manually and
`npx prisma migrate resolve --applied add_cohort_layer` — same result.)

## 2. backend/src/http/container.ts
a) Add imports at the top (after existing service imports):
```ts
import { CohortService } from "../modules/cohort/cohort.service";
import { CohortJobsService } from "../modules/cohort/cohort-jobs.service";
```
b) Add to `AppContainer` type:
```ts
  cohortService: CohortService;
  cohortJobsService: CohortJobsService;
```
c) In `createAppContainer()`, after `bunnyPlaybackService` and `emailService`
are constructed, add:
```ts
  const cohortService = new CohortService(prisma, bunnyPlaybackService);
  const cohortJobsService = new CohortJobsService(prisma, emailService, cohortService);
```
and include `cohortService, cohortJobsService` in the returned object.

## 3. backend/src/http/create-app.ts
a) Add import:
```ts
import { createCohortRouter } from "./routes/cohort.router";
```
b) After the existing `app.use(createSubscriptionsRouter(c));` line, add:
```ts
  app.use(createCohortRouter(c));
```

## 4. backend/src/server.ts
After the container is created and before/after `listen`, start the jobs:
```ts
container.cohortJobsService.start();
```
(Set `COHORT_JOBS_DISABLED=true` in tests/CI to keep them off.)

## 5. backend/src/modules/email/email.service.ts
Add ONE public method inside `export class EmailService { ... }` (reuses the
existing private sendMail with all its SES/ElasticEmail/Ethereal fallbacks):

```ts
  /** Cohort notifications (reminders, missed, warnings, weekly reports). */
  async sendCohortMail(to: string, mail: { subject: string; text: string; html: string }) {
    return this.sendMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
  }
```

## 6. frontend/src/components/portal/portal-shell.tsx
In the `links` array, insert directly beneath Dashboard (line ~12), importing
`Clock` from lucide-react alongside the existing icon imports:

```ts
  { href: "/portal/cohort", label: "Cohort live classes", icon: Clock },
```

Final order: Dashboard → **Cohort live classes** → Study plan → Past papers →
Progress → Results → Retake history.

## 7. Environment
Append the contents of `env.cohort.additions` to your backend `.env`.

That is the complete integration surface: 5 small patches + the new files.
No existing route, model, test engine, or video flow is modified.

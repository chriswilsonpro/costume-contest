# Costume Contest

React + AWS Amplify Gen 2 app for costume contest voting.

## Routes

- `/` — public voting ballot
- `/admin` — password-gated contest setup
- `/results` — live vote totals

## Voting rules

- One contestant per category
- A contestant can only appear once on a ballot
- Ballot id is stored in a cookie so voters can return and change picks

## Local development

```bash
npm install
npm run dev
```

Without an Amplify sandbox, the app uses **localStorage** as the backend so you can try the full flow immediately.

Default admin password: `costume` (override with `VITE_ADMIN_PASSWORD` in `.env`).

## Amplify backend

```bash
npx ampx sandbox
```

That writes a real `amplify_outputs.json`. Restart `npm run dev` and the app will use AppSync + DynamoDB.

Deploy with Amplify Hosting using the included `amplify.yml`. Set `VITE_ADMIN_PASSWORD` in the Hosting environment variables.

For SPA routing (`/admin`, `/results`), add a rewrite in Amplify Console → Hosting → Rewrites and redirects:

- Source: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>`
- Target: `/index.html`
- Type: `200` (Rewrite)

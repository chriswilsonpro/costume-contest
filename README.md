# Costume Contest

React + AWS Amplify Gen 2 app for costume contest voting.

## Routes

- `/` — public voting ballot
- `/admin` — password-gated contest setup
- `/results` — live vote totals

## Voting systems

Configured per contest in Admin:

### Classic

- One contestant per category
- A contestant can only appear once on a ballot
- Results assign at most one exclusive win per costume (category order decides priority)

### Multi-round (winner takes all)

- No categories — each voter picks one costume per round
- **Round 1:** everyone votes; top 3 advance (ties at 3rd all advance)
- **Round 2:** only finalists; counts start at 0; everyone votes again
- Round 1 totals break Round 2 ties; remaining ties are co-winners
- Admin manually opens and closes each round

Ballot id is stored in a cookie so voters can return and change picks while a round/contest is open.

## Media

- Contestant photos (PNG/WebP keep transparent backgrounds) upload from Admin
- Results background: built-in Halloween night scene, or a custom uploaded image
- Amplify mode uses S3 via Amplify Storage + Cognito guest identities
- Local mode stores images as data URLs in `localStorage` (size-limited)

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

That writes a real `amplify_outputs.json` with Data, Auth (guest identity pool), and Storage. Restart `npm run dev` and the app will use AppSync + DynamoDB + S3.

Deploy with Amplify Hosting using the included `amplify.yml`. Set `VITE_ADMIN_PASSWORD` in the Hosting environment variables.

For SPA routing (`/admin`, `/results`), add a rewrite in Amplify Console → Hosting → Rewrites and redirects:

- Source: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>`
- Target: `/index.html`
- Type: `200` (Rewrite)

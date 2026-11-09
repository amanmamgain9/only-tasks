# Plan My Workday

A keyboard-first planner for your workday. Chat is the main surface: tell it what you want to get done, and the real task tree, timer, daily targets and review show up inline as editable components. Everything works without a mouse.

<video src="public/media/plan-my-workday/demo.mp4" poster="public/media/plan-my-workday/demo-poster.jpg" controls muted></video>

The hosted version is no longer running. This repo is the full app.

## Stack

- Next.js 15 and React 19, frontend and API in one app
- SQLite with Drizzle ORM (better-sqlite3)
- Google OAuth
- Paddle for billing
- An LLM-backed workspace agent and recurrence assistant (OpenAI or Kimi)

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Google OAuth and an LLM key
npm run dev                  # http://localhost:5173
```

Set `PLANMYWORKDAY_BILLING_ENFORCEMENT=0` in `.env.local` to skip the paywall locally.

To seed a demo user and re-record the demo video, see [scripts/demo](scripts/demo/README.md).

## Tests

```bash
npm test
```

## More

- [Product vision](docs/product-vision.md)
- [Architecture](architecture.md)

## License

MIT

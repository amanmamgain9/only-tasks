# Plan My Workday Real-App Demo Capture

This folder records the actual Plan My Workday app, not a separate demo UI.

- `seed-real-demo-user.mjs`: creates `demo@planmyworkday.dev`, grants manual lifetime access, seeds projects/tasks/date views, and writes a local auth cookie to `.demo-auth.json`.
- `capture-real-app-demo.mjs`: launches Chrome/CDP, opens the real `/app/workspace/all-tasks`, sets the seeded auth cookie, drives the real UI, and captures frames into `scripts/demo/frames/`.
- `encode-pmwd-demo.mjs`: encodes those frames into `public/media/plan-my-workday/demo.mp4` and writes `demo-poster.jpg`.
- `frames/`: generated working frames, intentionally ignored by git.

Commands:

```bash
node scripts/demo/seed-real-demo-user.mjs
npm run dev
node scripts/demo/capture-real-app-demo.mjs
node scripts/demo/encode-pmwd-demo.mjs
```

The capture script needs the local app running and headless Chrome.

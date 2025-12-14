Demo: running the frontend with the mock backend

Prerequisites:
- Node >= 18, npm >= 8
- Run this project from the repository root

Quick start:

1) Start the mock backend and the frontend (dev server):

   npm run mock:start

   # in another terminal (or use the start script):
   npm run dev

Or use the helper that starts both (makes logs under /tmp):

   sh tools/start-demo.sh

2) Run the automated demo scenario (headless, saves screenshots to /tmp):

   npm run demo:run

Files created by the demo:
- Screenshots: /tmp/demo-*.png
- Mock server log: /tmp/mock-backend.log
- Next dev server log: /tmp/next.log (if started via tools/start-demo.sh)

Notes & trouble-shooting:
- If you see CORS or ECONNREFUSED errors, ensure the mock backend is running on port 8080.
- The demo uses Node's global `fetch`. If your Node is older than v18, install `node-fetch` or upgrade Node.
- If the frontend shows React runtime warnings (e.g. "Maximum update depth exceeded"), the mock may not be returning the exact payload shape expected by some providers. Contact the repo maintainer for further hardening of mock payloads.

Want a recording (video)? You can run the demo with a screen recorder (e.g. `ffmpeg`) while the demo runs and capture the browser window; alternatively the demo could be extended to capture a screencast directly.

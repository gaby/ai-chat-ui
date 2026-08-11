# Screenshots

Reference shots of the chat UI, linked from the pull request that introduced it.

They are captured against the deterministic test server (`tests/server/server.py`),
not a live provider, so every one of them is reproducible: the replies, tool calls,
token counts and failures all come from the `FunctionModel` fixtures that the E2E
suite uses. Desktop shots are a 1280×820 viewport; the mobile pair is an emulated
iPhone 13.

To retake them, run the test server and the dev server against it —

```bash
pnpm test:server                                   # deterministic backend on :38787
BACKEND_PORT=38787 pnpm vite --port 54321          # UI pointed at it
```

— then drive the fixtures listed below and screenshot the page.

| File                        | Fixture      | What it shows                                         |
| --------------------------- | ------------ | ----------------------------------------------------- |
| `welcome-{light,dark}`      | —            | Empty chat: greeting, composer, suggested prompts     |
| `markdown-{light,dark}`     | `markdown`   | Code block, typeset math, links, inline code          |
| `activity-folded-light`     | `multi-tool` | A turn's work folded to one line that names the tools |
| `activity-open-light`       | `multi-tool` | The same turn opened, each step on the rail           |
| `tool-detail-dark`          | `tool`       | A tool card open on its arguments and result          |
| `approval-light`            | `approval`   | The approval gate, holding the block open             |
| `tool-error-dark`           | `error`      | A failed call, reason inline                          |
| `run-failure-light`         | `failure`    | A failed run: what broke, how to recover              |
| `reasoning-dark`            | `reasoning`  | Thinking, opened as steps                             |
| `token-usage-light`         | `text`       | Per-conversation usage, broken down                   |
| `effort-meter-dark`         | —            | Thinking effort as a meter rather than a dropdown     |
| `sidebar-dark`              | several      | History, date buckets, per-row menu                   |
| `shortcuts-light`           | —            | The keyboard shortcuts dialog                         |
| `mobile-conversation-light` | `multi-tool` | The same turn on a phone                              |
| `mobile-drawer-light`       | —            | The sidebar as a sheet                                |

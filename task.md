I’m building a super simple MVP integration service between ClickUp, Claude, and GitHub.
Here’s the flow I need in index.js (Node.js, single file, minimal):

Use Express to set up a small server.

Expose an endpoint /webhook to receive ClickUp webhook events.

Log the task payload (title, description).

When a new task is assigned to my bot user:

Take the task title + description.

(For now, mock Claude by returning a hardcoded “Hello World” JavaScript file.)

Connect to GitHub using Octokit with my Personal Access Token.

Create a new branch (e.g. task-[id]).

Commit the generated file.

Open a Pull Request targeting main.

Keep it minimal — no database, no fancy config. Just:

express for server.

axios (in future for Claude API calls).

octokit for GitHub PR.

Add comments in the code explaining where to insert:

ClickUp API secret validation.

Claude API call (currently mocked).

GitHub repo/org details.

Basically, I want a single-file Node.js skeleton that:
ClickUp Task → Webhook → Dummy Claude Code → GitHub Branch + PR.



here is clickup api: VZR29KJRNICR99L3WAH5D6YZDWLIPFPNA1OIPZNJQQ47J35Z7JOUJ7UB1PPUCQVL
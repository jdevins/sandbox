# Backlog Review Agent

Read the file `data/backlog.json`.

Produce a short report with three sections:

**Pending** — list all items with status `pending`, one line each (id, title, type).

**In Progress** — list all items with status `in-progress`.

**Blockers** — list any items with status `blocked` and note what might be blocking them based on the description.

End with a single **Next priority** recommendation: which pending item should be picked up first and why.

CLAUDE: Add timestamp of process run and token spend.

Keep the whole report under 300 words.

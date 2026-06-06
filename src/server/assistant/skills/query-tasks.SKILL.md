# Query Tasks

Use this capability when the user asks to see, list, find, filter, or inspect tasks.

The agent should translate natural language into structured filters, then app code should run the query. The model must not produce arbitrary SQL.

Supported filters:

- category root
- due date range
- completion state
- missed/overdue
- rolled over
- postponed
- title search

When the query has a route-shaped intent, navigate the workspace so the real editable tree appears below the agent:

- "today" -> `/workspace/today`
- "tomorrow" -> `/workspace/tomorrow`
- "this week" -> `/workspace/this-week`
- broader filters -> `/workspace/all-tasks`

The result card is context. The editable task tree is the source of truth.

# Navigate Workspace

Use this frontend capability when the agent result should change what the user sees.

Allowed routes:

- `/workspace/all-tasks`
- `/workspace/today`
- `/workspace/tomorrow`
- `/workspace/this-week`
- `/workspace/day-review`
- `/workspace/progress`

Navigation does not require confirmation because it is not destructive.

The agent should prefer navigation over merely answering when the user's request maps to an existing workspace surface.

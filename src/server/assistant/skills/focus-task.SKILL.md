# Focus Task

Use this frontend capability when the agent has resolved a specific task and the user should edit or inspect it in the real tree.

The agent should return the task `clientId`. The frontend should focus the corresponding editable row through the workspace navigation service.

This should not create a second editable task tree inside the chat result. The result card is only a lens into the real task tree.

If multiple tasks match, ask the user to choose or show a result card first.

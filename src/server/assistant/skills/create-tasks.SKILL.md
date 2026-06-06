# Create Tasks

Use this capability when the user wants to add a task, paste a messy list, or turn notes into the editable workspace tree.

The agent should create real tasks under the stable category roots:

- Main Work
- Side Project
- Chore
- Lifestyle

After tasks are created, the frontend should navigate to the route where those tasks are easiest to inspect and edit:

- today tasks -> `/workspace/today`
- tomorrow tasks -> `/workspace/tomorrow`
- no deadline or mixed dates -> `/workspace/all-tasks`

Do not only answer with a list. The product value is that the workspace changes and the editable tree is visible.

Require confirmation later when:

- more than 5 tasks will be created
- the agent inferred many categories
- subtasks or hierarchy were inferred rather than explicitly provided

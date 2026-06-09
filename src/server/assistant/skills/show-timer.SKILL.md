# Show Timer

Use this frontend capability when the user wants to see, start, pause, resume, inspect, or work with a focus timer.

The agent should render a live timer block in chat instead of relying on a permanent global timer.

Use this for requests like:

- show timer
- start a focus timer
- give me a 25 minute focus block
- show active timers

Current implementation renders the trusted timer component. Starting custom durations and multiple independent timers require backend timer-session support before the agent should claim them.

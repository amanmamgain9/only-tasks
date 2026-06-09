# Plan My Workday Product Vision

Plan My Workday is a chat-native, keyboard-first workday workspace. The user should be able to tell the app what they want to get done, see the real workspace update, and keep working without learning routes, product terminology, or a dashboard-heavy planning system first.

The app is not a prose-only chatbot. The chat is the primary work surface, and native UI artifacts appear inside it when they help the user act: today's task tree, timer, day review, progress, daily targets, and recap. These artifacts must remain real, editable, keyboard-operable app components.

## Core Principles

- The user is here to do tasks, not to learn the product.
- Chat is the front door and default workspace for the current workday.
- The visible UI is the source of truth; agent output should operate or reveal real app surfaces instead of describing where to click.
- Artifacts appear when requested or needed, stay out of the way when not useful, and remain directly reopenable.
- Keyboard operation is app-wide: route transitions, chat, artifacts, modal scopes, task tree, timer, review, progress, and settings must preserve predictable focus behavior.
- The timer supports focused work but stays secondary to tasks, targets, and review unless the user asks for timer behavior.

## Interaction Model

The product has two cooperating layers:

- Agent operation layer: a natural-language control surface that understands the current workday, invokes app-native capabilities, updates real state, and gives compact confirmations.
- Direct manipulation UI: task tree, keyboard navigation, task editing, scheduling, recurrence, timer, daily targets, review, progress, recap, account, and billing surfaces.

The agent should make the first useful workspace state for the user, then let the user inspect and adjust it through native UI. New users should succeed through chat first and discover faster keyboard-first controls through outcomes.

## Current Workday Shape

The default current-day screen should show the conversation, composer, and a compact set of artifact shortcuts. It should not render the task tree, timer, daily targets, progress, review, or route sidebar by default.

When the user asks to see today's tasks, the editable task tree appears as a chat artifact. When the user asks to start or show a timer, the timer appears as a chat artifact. When the user asks to close the day, the review flow appears only with the missing proof or confirmation needed. When the user asks how they are doing, progress or recap appears as a working artifact rather than a wall of prose.

The unit of context is the user's workday window, not strict midnight. Workday history should remain accessible without making old days feel like active work.

## Artifact Standard

Artifacts must be:

- openable from chat commands, agent actions, route-shaped results, or direct shortcuts
- expandable or fullscreen when the user needs more room
- closable without losing the ability to reopen recent work
- keyboard-safe, including focus transfer in, operation inside the artifact, Escape/close behavior, and focus restoration
- real UI, not screenshots or prose substitutes
- conservative in default presence so the chat-first workspace does not become a permanent dashboard

The first artifact slice should prove the model with today's task tree and timer before expanding to review, progress, daily targets, recap, and workday lifecycle persistence.

# Chat-Native Workspace Artifacts

Last updated: 2026-06-09

## Purpose

Plan My Workday uses chat as the default current-day workspace, but the chat is not the system of record. The visible app UI remains the source of truth. When the user asks for a working surface, the agent or quick controls render native UI artifacts inside the chat workspace so the user can inspect and operate real controls without switching mental models.

Story 001 proves this model with the Today task tree and Timer artifacts. Review, progress, daily targets, recap, and broader workday lifecycle behavior remain extension points, not default story-001 surfaces.

## Current Behavior

- The default `/app/workspace` shell renders the Plan agent header, compact Today and Timer artifact shortcuts, conversation area, empty state, and composer.
- No task tree, timer, daily targets, review, progress, or recap artifact is mounted by default on the chat route.
- Clicking Today opens an active `task_tree` artifact for today's editable task tree and navigates to `/workspace/today` so route context stays aligned.
- Clicking Timer opens an active `timer` artifact with embedded `WorkspaceTimer` controls.
- Supported direct prompts such as "show today's tasks" and "start a focus session" are resolved deterministically before the LLM path and return frontend `show_block` actions.
- One primary artifact is active at a time. Opening another artifact replaces the active stage while pinned and recent chips remain reopenable.
- Active artifacts can be expanded to an app-level full-window shell and returned to chat size without unmounting native content.
- Closing an artifact clears the active stage and restores focus to the chat composer.

## Entrypoints

- `src/features/workspace/components/WorkspaceApp.tsx` owns the `/app` router and maps workspace routes to `MyWorkplaceComponent` with a surface and optional date filter.
- `src/features/workspace/components/MyWorkplaceComponents/MyWorkplaceComponent.tsx` provides the `workspace-region` focus region and delegates the workspace surface.
- `src/features/workspace/components/MyWorkplaceComponents/MyWorkdayTasksComponent.tsx` resolves the workspace project, derives route-owned `WorkspaceUiBlock` values, creates the renderer, and passes everything into `WorkspaceAgentPanel`.
- `src/features/workspace/components/AgentComponents/WorkspaceAgentPanel.tsx` is the chat workspace shell and artifact session owner.
- `src/features/ai/AssistantChatBox.tsx` is the generic chat composer, message list, suggestions, and `liveContent` host.
- `src/server/assistant/workspaceAgent.ts` executes deterministic commands and LLM-resolved workspace commands, persists the thread, and returns `WorkspaceUiAction` values.
- `src/server/assistant/capabilities.ts` defines backend route, block, and UI action schemas shared by the agent execution model.

## Important Components

- `WorkspaceAgentPanel` owns artifact presentation state: active artifact key, expanded state, pinned restore/load, recent artifacts, route-owned artifact synchronization, and focus transfer.
- `ArtifactStage` is the artifact chrome inside `WorkspaceAgentPanel`. It renders title/status, expand/return, pin/unpin, close controls, and native block content.
- `workspaceArtifacts.ts` defines artifact identity, titles, singleton/deduping behavior, pinned serialization, and restore semantics.
- `workspaceUiBlocks.tsx` maps `WorkspaceUiBlock` contracts to native React components through the agent-runtime renderer registry.
- `TreeMainComponent` remains the native editable task tree. It owns task-tree domain behavior, editor store interaction, modals, and task focus behavior.
- `WorkspaceTimer` remains the native timer. It owns timer status queries, mutations, settings/focus dialogs, ticking, and embedded rendering.
- `NavigationService` remains the shared focus mechanism used by workspace shell, artifact opening/closing, tree operations, and timer modal scopes.
- `workspaceLlm.ts` is the configurable LLM command resolver. It is an extension path for richer commands, not required for guaranteed Today and Timer prompts.

## Contracts

The UI handoff contract is `WorkspaceUiAction`:

- `navigate` changes the visible workspace route.
- `show_block` asks the frontend to render a native block in the artifact stage.
- `focus_task` focuses an existing editable task row when a client id is known.

The rendered payload contract is `WorkspaceUiBlock`:

- `task_tree` with view `all`, `today`, `tomorrow`, or `this_week`
- `timer` with mode `compact` or `full`
- `day_review`
- `progress`
- `daily_targets`

Story 001 makes `task_tree:today` and `timer:workspace` first-class default artifact surfaces. Other block types remain valid for route bridges and future agent flows, but they are not always-visible quick actions in this slice.

## State Ownership

- Artifact shell/session state belongs to `WorkspaceAgentPanel`.
- Chat input, message scrolling, suggestions, and live content placement belong to `AssistantChatBox`.
- Task data, editing, filtering, scheduling, recurrence, deletion, and import behavior belong to `TreeMainComponent` and its store/services.
- Timer sessions, settings, mutations, focus mode, and timer dialogs belong to `WorkspaceTimer`.
- Assistant threads and structured action payloads belong to the assistant server layer and SQLite assistant tables.
- Pinned artifact metadata is local UI preference state stored per project in `localStorage` as `pmwd.workspace-artifacts.${projectId}`. Only pinned metadata is persisted; recent unpinned artifacts are session state.

## Control Flow

Quick Today:

1. The Today chip calls `openArtifact(todayBlocks(), { focus: true, source: "quick" })`.
2. `WorkspaceAgentPanel` upserts `task_tree:today`, makes it active, clears expanded mode, and schedules focus into artifact content.
3. The workspace router navigates to `/workspace/today`.
4. Route blocks for Today are synchronized back into the artifact map as source `route`.
5. The renderer displays `TreeMainComponent` with `dueDateFilter="today"`.

Quick Timer:

1. The Timer chip opens a `timer` block as source `quick`.
2. The artifact key dedupes to `timer:workspace`.
3. The renderer displays `WorkspaceTimer embedded` with compact mode.
4. Focus lands on timer native controls before falling back to artifact chrome.

Agent prompt:

1. `WorkspaceAgentPanel` submits the prompt with project id, current view, and browser timezone.
2. `workspaceAgent.ts` checks deterministic Today/Timer parsing first.
3. If no deterministic command matches, the LLM path may resolve a supported command when configured and rate limits allow it.
4. The server stores user and assistant messages with structured `workspace_agent_action` payloads.
5. The frontend extracts `uiActions`, navigates when needed, opens shown blocks, and invalidates workspace summaries after task mutations.

## Focus and Keyboard Requirements

- The workspace shell initializes `NavigationService` around a root `data-scope`.
- `MyWorkplaceComponent` exposes `#workspace-region` for focus targets.
- Opening an artifact first targets `[data-entrypoint-focus]` inside artifact content, then any native focusable control, then artifact chrome.
- Closing an artifact focuses the chat composer textarea.
- Expanded artifact mode is reversible app shell state, not the browser Fullscreen API and not timer focus mode.
- Timer settings and focus dialogs use their own scoped focus handling and remain independent of the artifact expanded shell.

## Performance Considerations

- Only the active artifact is mounted in the live content area; all possible artifacts are not hidden-mounted.
- The recent list is capped to four unpinned artifacts.
- LocalStorage writes only serialize pinned artifacts and malformed pinned state is ignored on restore.
- Deterministic Today/Timer handling avoids network calls and LLM quota/rate-limit paths for guaranteed commands.
- Expanded mode changes shell layout around the same active artifact instead of creating a second browser-level fullscreen surface.
- Task and timer data refresh remains with their existing query/store layers; the artifact shell does not duplicate domain caches.

## Extension Points

- Add future native artifact renderers in `useWorkspaceUiBlockRenderer`.
- Add new block/action shapes in both `src/features/ai/types.ts` and `src/server/assistant/capabilities.ts` so frontend and backend contracts stay aligned.
- Add future agent capabilities through `ASSISTANT_CAPABILITIES`, skill files, and `workspaceLlm.ts` command schemas.
- Extend `workspaceArtifacts.ts` with workday metadata when artifacts become scoped to a workday window.
- Add future quick shortcuts only when product scope makes that artifact a default surface; the registry can support more block types without promoting them to default UI.

## Abstraction Limits

- Do not move task tree or timer business logic into chat-specific components.
- Do not introduce a global docking framework, multi-pane layout manager, or browser fullscreen dependency for the story-001 artifact shell.
- Do not persist recent unpinned artifacts in this slice.
- Do not make review, progress, daily targets, recap, or workday lifecycle flows default artifacts until their own stories define behavior and testing expectations.
- Do not rely on a live LLM for the guaranteed Today and Timer artifact commands.

## Validation

The story has automated coverage for the architecture boundaries:

- `WorkspaceAgentPanel.test.tsx` covers no default artifact, route-owned artifacts, close focus return, native focus preference, Today without Daily Targets, default shortcuts narrowed to Today/Timer, and expanded-mode reversibility.
- `workspaceArtifacts.test.ts` covers artifact identity, deduping, stale companion-block replacement, timer singleton behavior, and pinned persistence.
- `workspaceAgentDeterministic.test.ts` covers deterministic Today/Timer command parsing and verifies mutation/other-route prompts are not hijacked.

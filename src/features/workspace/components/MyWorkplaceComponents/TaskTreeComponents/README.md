# TaskTree Component System

## Overview

The **TaskTree** is a sophisticated hierarchical task management system with optimistic UI updates, undo/redo support, and seamless backend synchronization. It provides an infinite-depth tree structure for organizing projects and tasks with real-time collaboration support.

### Key Features

✅ **Hierarchical Tasks**: Unlimited nesting depth with parent-child relationships
✅ **Optimistic Updates**: Instant UI feedback with backend sync
✅ **Undo/Redo System**: Full history tracking with operation inversion
✅ **Client-First Architecture**: Operations work with temporary client IDs before backend IDs exist
✅ **Fractional Indexing**: Efficient reordering without touching other items
✅ **Keyboard Navigation**: Full keyboard support with arrow keys and Tab (see [KEYBOARD_NAVIGATION.md](../../../_services/KEYBOARD_NAVIGATION.md))
✅ **Breadcrumb Navigation**: Drill down into subtasks and navigate back
✅ **Import/Export**: Bulk task import with hierarchy preservation
✅ **Autosave**: Automatic backend sync with debouncing

## Architecture

### State Management

The system uses **Zustand** with **Immer** for immutable state updates:

```typescript
// useTree.tsx
const useTreeStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    isLoading: false,
    loadError: null,
    editor: {
      project: null,
      tasks: [],
      expandedTaskIds: new Set(),
      currentRootTaskId: null,
    },
    history: [],
    futureHistory: [],
    autosave: {
      isDirty: false,
      isSaving: false,
      lastSaveTime: null,
      saveError: null,
    },
    unsavedOperations: [],
    // ... methods
  }))
);
```

### Core Data Types

#### EnhancedTaskTreeType

Tasks with client-side enhancements for optimistic updates:

```typescript
// types.ts
export interface EnhancedTaskTreeType extends Omit<TaskTreeType, 'id' | 'subtasks'> {
  clientId: string;          // Unique client-generated ID
  id?: number;               // Backend ID (undefined for new tasks)
  subtasks?: EnhancedTaskTreeType[];
  isEphemeral?: boolean;     // True for empty placeholder tasks
  position: string;          // Fractional index for ordering
}
```

#### Operation Types

All changes are represented as operations:

```typescript
// types.ts
export type Operation =
  | { type: 'TOGGLE_EXPANSION'; clientId: string; isExpanded: boolean; timestamp: number }
  | { type: 'SET_CURRENT_ROOT'; clientId: string | null; timestamp: number }
  | { type: 'CREATE_TASK'; clientId: string; parentClientId: string | null; position: string; metadata?: {...}; timestamp: number }
  | { type: 'UPDATE_TITLE'; clientId: string; title: string; timestamp: number }
  | { type: 'TOGGLE_COMPLETE'; clientId: string; isCompleted: boolean; timestamp: number }
  | { type: 'DELETE_TASK'; clientId: string; timestamp: number }
  | { type: 'UPDATE_METADATA'; clientId: string; estimatedTimeMinutes?: number | null; dueDate?: string | null; priority?: number | null; description?: string | null; timestamp: number }
  | { type: 'IMPORT_TASKS'; rootClientId: string; parentClientId: string | null; subtree: SubtreeNode; timestamp: number };
```

#### Operation Batches

Operations are batched for efficient backend sync:

```typescript
export type OperationBatch = {
  operations: Operation[];
  batchId: string;           // UUID for idempotency
  projectId: number;
  timestamp: number;
};
```

## Component Structure

```
TaskTreeComponents/
├── README.md                      # This file
├── types.ts                       # Type definitions
├── useTree.tsx                    # Main Zustand store (400+ lines)
├── treeMutations.ts              # Operation application logic
├── treeAdapter.ts                # Data transformation functions
├── positionUtils.ts              # Fractional indexing utilities
├── useNodeInternalNavigation.ts  # Node-level keyboard navigation
├── TaskTreeMainComponent.tsx     # Main tree container
├── TreeNodeComponent.tsx         # Individual tree node
├── TreeNodeMenu.tsx             # Context menu for nodes
├── TreeRootEditor.tsx           # Editor for current root task
├── Breadcrumb.tsx               # Navigation breadcrumb
├── ImportTasksModal.tsx         # Bulk import modal
├── ScheduleModal.tsx            # Task scheduling modal
├── ConfirmModal.tsx             # Confirmation dialogs
└── MaskedDateInput.tsx          # Date input component
```

## Key Concepts

### 1. Client IDs vs Backend IDs

The system uses a **client-first** approach:

- **Client ID**: Generated locally with `uuidv4()` when creating a task
- **Backend ID**: Assigned by server when task is saved

```typescript
// Creating a new task
const newTask: EnhancedTaskTreeType = {
  clientId: uuidv4(),    // "550e8400-e29b-41d4-a716-446655440000"
  id: undefined,         // No backend ID yet
  title: "",
  isCompleted: false,
  position: "a0",
  // ... other fields
};

// After backend sync
const syncedTask: EnhancedTaskTreeType = {
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  id: 1234,              // Backend assigned ID
  // ... same fields
};
```

**Benefits**:
- Optimistic UI updates work immediately
- No waiting for server responses
- Operations reference stable client IDs

### 2. Fractional Indexing

Tasks use **fractional indexing** for efficient reordering without updating sibling positions.

```typescript
// positionUtils.ts
export const INITIAL_POSITION = 'a0';

// Example positions:
// "a0" < "a0V" < "a1" < "a2" < "b0"
```

**Reordering example**:
```typescript
// Initial state:
// Task A: position "a0"
// Task B: position "a2"

// Insert Task C between A and B:
// Task C: position "a1" (midpoint between "a0" and "a2")

// Only Task C needs to be updated!
```

See `fractional-indexing` npm package for implementation details.

### 3. Operation System

All state changes go through operations for undo/redo support:

```typescript
// treeMutations.ts
export function applyOperationToState(
  state: EditorState,
  operation: Operation
): EditorState {
  return produce(state, draft => {
    switch (operation.type) {
      case 'CREATE_TASK':
        // Apply task creation
        break;
      case 'UPDATE_TITLE':
        const task = findTaskByClientId(draft.tasks, operation.clientId);
        if (task) task.title = operation.title;
        break;
      // ... other operations
    }
  });
}
```

**Inverse operations** enable undo:

```typescript
export function getInverseOperation(
  operation: Operation,
  state: EditorState
): Operation | null {
  switch (operation.type) {
    case 'UPDATE_TITLE':
      const task = findTaskByClientId(state.tasks, operation.clientId);
      return {
        type: 'UPDATE_TITLE',
        clientId: operation.clientId,
        title: task?.title || '',  // Previous title
        timestamp: Date.now()
      };
    case 'CREATE_TASK':
      // Inverse is DELETE_TASK
      return {
        type: 'DELETE_TASK',
        clientId: operation.clientId,
        timestamp: Date.now()
      };
    // ... other inversions
  }
}
```

### 4. Undo/Redo System

```typescript
// useTree.tsx
undo: () => {
  const { history, futureHistory, editor } = get();
  if (history.length === 0) return;

  const entry = history[history.length - 1];
  const inverseOp = getInverseOperation(entry.operation, editor);

  if (inverseOp) {
    const newState = applyOperationToState(editor, inverseOp);

    set({
      editor: newState,
      history: history.slice(0, -1),
      futureHistory: [...futureHistory, entry]
    });
  }
},

redo: () => {
  const { futureHistory, editor } = get();
  if (futureHistory.length === 0) return;

  const entry = futureHistory[futureHistory.length - 1];
  const newState = applyOperationToState(editor, entry.operation);

  set({
    editor: newState,
    history: [...get().history, entry],
    futureHistory: futureHistory.slice(0, -1)
  });
},
```

### 5. Ephemeral Tasks

Empty placeholder tasks that enable inline creation:

```typescript
// Always ensure empty task at end of list
export function ensureEmptyNodesEverywhere(state: EditorState): EditorState {
  return produce(state, draft => {
    const addEmptyIfNeeded = (tasks: EnhancedTaskTreeType[]) => {
      // Check if last task is empty
      const lastTask = tasks[tasks.length - 1];
      if (!lastTask || lastTask.title?.trim() !== '') {
        // Add empty placeholder
        tasks.push({
          clientId: uuidv4(),
          title: '',
          isCompleted: false,
          isEphemeral: true,
          position: generateNextPosition(tasks),
          // ... other fields
        });
      }
    };

    addEmptyIfNeeded(draft.tasks);
    // Recursively add to all subtask arrays
  });
}
```

**Benefits**:
- Users can always add new tasks by clicking/typing
- Clean UX without explicit "Add Task" button

### 6. Autosave System

Debounced automatic saving with operation batching:

```typescript
// useTree.tsx - subscription middleware
useTreeStore.subscribe(
  (state) => state.unsavedOperations,
  (unsavedOps) => {
    if (unsavedOps.length === 0) return;

    // Debounce: wait 2 seconds after last change
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      const state = useTreeStore.getState();
      if (!state.editor.project) return;

      // Create operation batch
      const batch: OperationBatch = {
        operations: unsavedOps,
        batchId: uuidv4(),
        projectId: state.editor.project.id,
        timestamp: Date.now()
      };

      // Send to backend
      await applyOperationBatch(batch);

      // Mark as saved
      useTreeStore.setState({
        unsavedOperations: [],
        autosave: { ...state.autosave, isDirty: false, lastSaveTime: Date.now() }
      });
    }, 2000);
  }
);
```

## Data Flow

### 1. Loading a Project

```
User Action: Click "Open Project"
    ↓
TaskTreeMainComponent.useEffect()
    ↓
useTreeStore.loadProjectTree()
    ↓
backendService.getProjectTree(projectId)
    ↓
Backend returns: { project, tasks: TaskTreeType[] }
    ↓
Transform tasks to EnhancedTaskTreeType (add clientIds)
    ↓
ensureEmptyNodesEverywhere()
    ↓
set({ editor: { project, tasks, expandedTaskIds, currentRootTaskId: null } })
    ↓
Component re-renders with tree
```

### 2. Creating a Task

```
User Action: Type in empty task input
    ↓
TreeNodeComponent.handleTitleChange()
    ↓
Check if ephemeral task becoming real
    ↓
useTreeStore.applyOperation({
  type: 'CREATE_TASK',
  clientId: task.clientId,
  parentClientId: parentTask?.clientId || null,
  position: task.position,
  timestamp: Date.now()
})
    ↓
applyOperationToState() - Update local state
    ↓
Add to history for undo
    ↓
Add to unsavedOperations
    ↓
ensureEmptyNodesEverywhere() - Add new empty task
    ↓
Component re-renders immediately (optimistic)
    ↓
Autosave timer triggers (2 seconds)
    ↓
Send OperationBatch to backend
    ↓
Backend processes operations and returns updated tasks with IDs
    ↓
Merge backend IDs into local state
    ↓
Clear unsavedOperations
```

### 3. Updating Task Title

```
User Action: Edit task title
    ↓
TreeNodeComponent.handleTitleChange()
    ↓
useTreeStore.applyOperation({
  type: 'UPDATE_TITLE',
  clientId: task.clientId,
  title: newTitle,
  timestamp: Date.now()
})
    ↓
applyOperationToState() - Update local state
    ↓
Add to history (with inverse operation for undo)
    ↓
Add to unsavedOperations
    ↓
Component re-renders immediately
    ↓
(Autosave will sync to backend)
```

### 4. Deleting a Task

```
User Action: Click delete button
    ↓
TreeNodeComponent calls delete handler
    ↓
useTreeStore.applyOperation({
  type: 'DELETE_TASK',
  clientId: task.clientId,
  timestamp: Date.now()
})
    ↓
applyOperationToState() - Remove task from tree
    ↓
Add to history (inverse is CREATE_TASK with full task data)
    ↓
Add to unsavedOperations
    ↓
Focus restoration logic
    ↓
Component re-renders
    ↓
(Autosave will sync deletion to backend)
```

## Component API

### TaskTreeMainComponent

Main container component for the tree.

```tsx
<TaskTreeMainComponent
  projectId={projectId}
  filterView="today" | "tomorrow" | "this-week" | null
/>
```

**Props**:
- `projectId?: number` - Project to load (optional)
- `filterView?: 'today' | 'tomorrow' | 'this-week' | null` - Filter tasks by due date

**Behavior**:
- Loads project tree on mount
- Subscribes to store updates
- Renders breadcrumb navigation
- Renders tree nodes

### TreeNodeComponent

Individual node in the tree.

```tsx
<TreeNodeComponent
  node={visibleNode}
  nodeIndex={index}
  currentFocus={focusLocation}
  setCurrentFocus={setFocusLocation}
  onNavigate={handleNavigation}
/>
```

**Props**:
- `node: VisibleNode` - Node data with depth and path info
- `nodeIndex: number` - Index in visible list
- `currentFocus: FocusLocation` - Current focused location
- `setCurrentFocus: (location: FocusLocation) => void` - Update focus
- `onNavigate: (direction: 'up' | 'down') => void` - Handle vertical navigation

**Features**:
- Inline title editing with textarea
- Completion checkbox
- Expand/collapse for nodes with children
- Delete button
- Add child button
- Make root button (promote to new root view)
- Context menu

### useNodeInternalNavigation

Hook for managing focus within a single node.

```typescript
const {
  // Refs
  titleInputRef,
  expandButtonRef,
  completionCheckboxRef,
  makeRootButtonRef,
  addChildButtonRef,
  deleteButtonRef,

  // Computed
  showMakeRootButton,
  showDeleteButton,

  // Methods
  handleInternalNavigation,  // Handle left/right within node
  focusFirst,                // Focus first element in node
  getCurrentFocusedElement,  // Get currently focused element name

  // Event handlers
  handleTitleFocus,
  handleExpandFocus,
  // ... other focus handlers
} = useNodeInternalNavigation({
  node,
  nodeIndex,
  hasChildren,
  currentFocus,
  setCurrentFocus
});
```

**Element Order** (left to right):
1. Expand button (if has children)
2. Completion checkbox
3. Make root button (if has title)
4. Title input
5. Add child button
6. Delete button (if not ephemeral)

## Backend Integration

### API Endpoints

#### Get Project Tree

```typescript
// backendService.ts
export async function getProjectTree(
  projectId: number
): Promise<{ project: Project; tasks: TaskTreeType[] }> {
  const response = await fetch(`${API_URL}/projects/${projectId}/tree`);
  return response.json();
}
```

**Response**:
```json
{
  "project": {
    "id": 1,
    "title": "My Project",
    "status": "active",
    // ... other project fields
  },
  "tasks": [
    {
      "id": 1,
      "title": "Task 1",
      "parentTaskId": null,
      "isCompleted": false,
      "position": "a0",
      "subtasks": [
        {
          "id": 2,
          "title": "Subtask 1",
          "parentTaskId": 1,
          "position": "a0",
          "subtasks": []
        }
      ]
    }
  ]
}
```

#### Apply Operation Batch

```typescript
export async function applyOperationBatch(
  batch: OperationBatch
): Promise<{ project: Project; tasks: TaskTreeType[] }> {
  const response = await fetch(`${API_URL}/projects/${batch.projectId}/operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch)
  });
  return response.json();
}
```

**Request**:
```json
{
  "operations": [
    {
      "type": "CREATE_TASK",
      "clientId": "uuid-1",
      "parentClientId": null,
      "position": "a0",
      "timestamp": 1234567890
    },
    {
      "type": "UPDATE_TITLE",
      "clientId": "uuid-1",
      "title": "New Task Title",
      "timestamp": 1234567891
    }
  ],
  "batchId": "batch-uuid",
  "projectId": 1,
  "timestamp": 1234567890
}
```

**Response**:
Same as Get Project Tree - returns updated project and tasks with backend IDs.

### Client ID Mapping

Backend must maintain a mapping between client IDs and backend IDs:

```sql
-- Example database schema
CREATE TABLE task_client_mappings (
  client_id VARCHAR(36) PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

When processing operations:
1. For CREATE_TASK: Generate backend ID, store mapping
2. For other operations: Look up task by clientId via mapping
3. Return full tree with both clientId and id fields

## Common Tasks

### Add a New Operation Type

1. **Define the operation type** in `types.ts`:

```typescript
export type Operation =
  | // ... existing operations
  | { type: 'UPDATE_PRIORITY'; clientId: string; priority: number; timestamp: number };
```

2. **Add operation creator** in `treeMutations.ts`:

```typescript
export function createUpdatePriorityOp(
  clientId: string,
  priority: number
): Operation {
  return {
    type: 'UPDATE_PRIORITY',
    clientId,
    priority,
    timestamp: Date.now()
  };
}
```

3. **Implement operation application** in `treeMutations.ts`:

```typescript
export function applyOperationToState(
  state: EditorState,
  operation: Operation
): EditorState {
  return produce(state, draft => {
    switch (operation.type) {
      // ... existing cases
      case 'UPDATE_PRIORITY':
        const task = findTaskByClientId(draft.tasks, operation.clientId);
        if (task) task.priority = operation.priority;
        break;
    }
  });
}
```

4. **Implement inverse operation** in `treeMutations.ts`:

```typescript
export function getInverseOperation(
  operation: Operation,
  state: EditorState
): Operation | null {
  switch (operation.type) {
    // ... existing cases
    case 'UPDATE_PRIORITY':
      const task = findTaskByClientId(state.tasks, operation.clientId);
      return {
        type: 'UPDATE_PRIORITY',
        clientId: operation.clientId,
        priority: task?.priority || 0,  // Previous priority
        timestamp: Date.now()
      };
  }
}
```

5. **Determine if operation needs backend sync** in `treeMutations.ts`:

```typescript
export function shouldSyncToBackend(operation: Operation): boolean {
  switch (operation.type) {
    case 'TOGGLE_EXPANSION':
    case 'SET_CURRENT_ROOT':
      return false;  // UI-only operations

    case 'UPDATE_PRIORITY':  // Add your operation
    case 'CREATE_TASK':
    case 'UPDATE_TITLE':
    // ... other synced operations
      return true;
  }
}
```

6. **Use in component**:

```typescript
const handlePriorityChange = (newPriority: number) => {
  useTreeStore.getState().applyOperation(
    createUpdatePriorityOp(task.clientId, newPriority),
    'Update Priority'
  );
};
```

### Add Task Metadata Field

1. **Update EnhancedTaskTreeType** in `types.ts`
2. **Update UPDATE_METADATA operation** to include new field
3. **Update backend schema** to store new field
4. **Add UI input** in TreeNodeComponent or modal
5. **Wire up to applyOperation** call

### Customize Keyboard Navigation

See `useNodeInternalNavigation.ts` for node-level navigation and [KEYBOARD_NAVIGATION.md](../../../_services/KEYBOARD_NAVIGATION.md) for global navigation.

**Example: Add a new focusable element**:

```typescript
// 1. Add ref
const myNewButtonRef = useRef<HTMLButtonElement>(null);

// 2. Add to element order
const elementOrder = useMemo(() => {
  const order: string[] = [];
  // ... existing elements
  order.push('myNewButton');
  return order;
}, [/* dependencies */]);

// 3. Add focus handler
const handleMyNewButtonFocus = useCallback(
  () => handleFocusEntered('myNewButton'),
  [handleFocusEntered]
);

// 4. Add to navigation switch
case 'myNewButton':
  myNewButtonRef.current?.focus();
  return true;

// 5. Return from hook
return {
  // ... existing returns
  myNewButtonRef,
  handleMyNewButtonFocus
};
```

## Testing

### Unit Tests

Test operation application logic:

```typescript
import { describe, test, expect } from 'vitest';
import { applyOperationToState, createUpdateTitleOp } from './treeMutations';

describe('Task Operations', () => {
  test('UPDATE_TITLE updates task title', () => {
    const initialState = {
      project: { id: 1, title: 'Project' },
      tasks: [{
        clientId: 'task-1',
        id: 1,
        title: 'Old Title',
        isCompleted: false,
        position: 'a0'
      }],
      expandedTaskIds: new Set(),
      currentRootTaskId: null
    };

    const operation = createUpdateTitleOp('task-1', 'New Title');
    const newState = applyOperationToState(initialState, operation);

    expect(newState.tasks[0].title).toBe('New Title');
  });
});
```

### Integration Tests

Test component interactions:

```typescript
import { render, fireEvent } from '@testing-library/react';
import { TreeNodeComponent } from './TreeNodeComponent';

test('editing title applies UPDATE_TITLE operation', async () => {
  const mockApplyOp = vi.fn();
  const node = {
    id: 'task-1',
    title: 'Task',
    isCompleted: false,
    // ... other fields
  };

  const { getByRole } = render(
    <TreeNodeComponent node={node} /* ... other props */ />
  );

  const input = getByRole('textbox');
  fireEvent.change(input, { target: { value: 'New Title' } });
  fireEvent.blur(input);

  expect(mockApplyOp).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'UPDATE_TITLE',
      clientId: 'task-1',
      title: 'New Title'
    })
  );
});
```

## Troubleshooting

### Problem: Tasks not appearing after creation

**Check**:
- Is `ensureEmptyNodesEverywhere()` being called after operation?
- Is the operation being added to `unsavedOperations`?
- Check browser console for errors

### Problem: Undo not working

**Check**:
- Is operation being added to history in `applyOperation()`?
- Does `getInverseOperation()` handle this operation type?
- Is the inverse operation correctly restoring state?

### Problem: Backend sync failing

**Check**:
- Is `shouldSyncToBackend()` returning true for the operation?
- Check network tab for API errors
- Verify operation batch format matches backend expectations
- Check backend logs for client ID mapping issues

### Problem: Focus lost after operation

**Check**:
- Are you using `NavigationService.focusByPath()` to restore focus?
- Is the focused element being removed from DOM?
- Check `useNodeInternalNavigation` focus handlers

### Problem: Position conflicts/duplicates

**Check**:
- Are you using `generateKeyBetween()` from `fractional-indexing` package?
- Check that positions are unique within each subtask list
- Verify backend is preserving position values

## Performance Considerations

### Virtualization

For large trees (>1000 visible nodes), consider adding virtualization:

```tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={visibleNodes.length}
  itemSize={40}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <TreeNodeComponent node={visibleNodes[index]} />
    </div>
  )}
</FixedSizeList>
```

### Memoization

Use `useMemo` for expensive computations:

```typescript
const visibleNodes = useMemo(
  () => flattenTree(treeNodes, expandedTaskIds),
  [treeNodes, expandedTaskIds]
);
```

### Debouncing

Title updates are debounced in the component to reduce operations:

```typescript
const debouncedTitleUpdate = useMemo(
  () => debounce((newTitle: string) => {
    applyOperation(createUpdateTitleOp(task.clientId, newTitle));
  }, 300),
  [task.clientId]
);
```

## Future Enhancements

- [ ] **Real-time Collaboration**: Operational Transform for concurrent editing
- [ ] **Offline Support**: IndexedDB cache with sync queue
- [ ] **Drag & Drop Reordering**: Visual reordering with position updates
- [ ] **Bulk Operations**: Select multiple tasks for batch actions
- [ ] **Task Templates**: Reusable task structures
- [ ] **Search & Filter**: Full-text search within tree
- [ ] **Archiving**: Soft delete with restore capability

---

**Related Documentation**:
- [Keyboard Navigation System](../../../_services/KEYBOARD_NAVIGATION.md)
- [Main CLAUDE.md](/home/user/atum-fe/CLAUDE.md)

**Key Files**:
- `useTree.tsx` - Main state management
- `treeMutations.ts` - Operation logic
- `treeAdapter.ts` - Data transformations
- `types.ts` - Type definitions
- `positionUtils.ts` - Fractional indexing

**Last Updated**: November 2024

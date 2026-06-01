// useEditorStore.ts - COMPLETE FILE WITH CHATID SUPPORT
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { produce } from "immer";
import { enableMapSet } from "immer";
import { v4 as uuidv4 } from 'uuid';

import type {
  EnhancedTaskTreeType,
  Project,
  Operation,
  OperationBatch,
  RecurrenceSchedule,
  SubtreeNode,
  PendingImportTask
} from "./types";

import {
  getProjectTree,
  applyOperationBatch
} from "../../../_services/backendService";
import { emitTaskOperationsSaved } from "../../../_events/taskOperationEvents";
import {
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  type LifestyleTraitAllocation,
  type TaskCategoryAllocation,
} from "@/features/categories/taskCategories";

import {
  type EditorState,
  type HistoryEntry,
  findTaskByClientId,
  findParentTask,
  applyOperationToState,
  getInverseOperation,
  shouldSyncToBackend,
  createToggleExpansionOp,
  createSetCurrentRootOp,
  createTaskOp,
  createUpdateTitleOp,
  createToggleCompletionOp,
  createDeleteTaskOp,
  createSetRecurrenceOp,
  createUpdateMetadataOp,
  ensureEmptyNodesEverywhere,
} from "./treeMutations";

enableMapSet();

/**
 * Calculate due date string based on filter view
 * Returns YYYY-MM-DD format in user's local timezone
 */
const calculateDueDateFromFilter = (
  filter: 'today' | 'tomorrow' | 'this-week'
): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  switch (filter) {
    case 'today':
      return `${year}-${month}-${day}`;
    
    case 'tomorrow': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const y = tomorrow.getFullYear();
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    case 'this-week': {
      // End of week (Sunday)
      const dayOfWeek = now.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endOfWeek = new Date(now);
      endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);
      const y = endOfWeek.getFullYear();
      const m = String(endOfWeek.getMonth() + 1).padStart(2, '0');
      const d = String(endOfWeek.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
};

interface AutosaveState {
  isDirty: boolean;
  isSaving: boolean;
  lastSaveTime: number | null;
  saveError: string | null;
}

type Store = {
  isLoading: boolean;
  loadError: string | null;
  editor: EditorState;
  history: HistoryEntry[];
  futureHistory: HistoryEntry[];
  autosave: AutosaveState;
  unsavedOperations: Operation[];

  loadProjectTree: () => Promise<void>;
  applyOperation: (operation: Operation, label: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToBackend: () => Promise<void>;

  getCurrentRootTasks: () => EnhancedTaskTreeType[];

  makeRoot: (params: { clientId: string | null }) => void;
  toggleExpansion: (params: { clientId: string }) => void;
  toggleCompletion: (params: { clientId: string }) => void;
  updateTitle: (params: { nodeType: 'task' | 'project'; title: string; clientId?: string }) => void;
  addChild: (params: { parentClientId: string; parentType: 'project' | 'task' }) => void;
  deleteNode: (params: { clientId: string }) => void;
  bulkImportTasks: (params: {
    parentClientId: string;
    parentType: 'project' | 'task';
    tasks: PendingImportTask[]
  }) => Promise<void>;
  updateMetadata: (params: {
    clientId: string;
    estimatedTimeMinutes?: number | null;
    dueDate?: string | null;
    priority?: number | null;
    description?: string | null;
    categoryAllocations?: TaskCategoryAllocation[];
    lifestyleTraits?: LifestyleTraitAllocation[];
  }) => void;
  setRecurrence: (params: { clientId: string; recurrence: RecurrenceSchedule }) => Promise<void>;
};

let saveTimer: NodeJS.Timeout | null = null;
const SAVE_DELAY = 1500;

function getSaveDelay(operations: Operation[]) {
  return operations.some((operation) => operation.type === "TOGGLE_COMPLETE") ? 0 : SAVE_DELAY;
}

function clearSaveTimer() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
}

function scheduleBackendSave(save: () => Promise<void>, operations: Operation[]) {
  clearSaveTimer();
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void save();
  }, getSaveDelay(operations));
}

// ✅ UPDATED: Accept chatId parameter
export const createEditorStore = (
  project: Project,
  dueDateFilter?: 'today' | 'tomorrow' | 'this-week',
  chatId?: number // ✅ NEW PARAMETER
) => {
  return create<Store>()(
    subscribeWithSelector((set, get) => ({
      isLoading: false,
      loadError: null,

      // ✅ UPDATED: Store chatId in editor state
      editor: {
        project,
        tasks: [],
        currentRootTaskId: null,
        expandedTasks: new Set(),
        selectionId: undefined,
        dueDateFilter,
        chatId, // ✅ NEW FIELD
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

      // ✅ UPDATED: Send chatId in API call
      loadProjectTree: async () => {
        set({ isLoading: true, loadError: null });

        try {
          const params: any = {};
          if (dueDateFilter) params.dueDate = dueDateFilter;
          if (chatId) params.chatId = chatId; // ✅ NEW

          const response = await getProjectTree(get().editor.project.id, params);

          if (response?.success && response.data) {
            const enhancedTasks = response.data as EnhancedTaskTreeType[];

            const newEditor = produce(get().editor, draft => {
              draft.tasks = enhancedTasks;
              draft.expandedTasks = new Set(
                enhancedTasks
                  .filter((task) => task.systemType === "category_root")
                  .map((task) => task.clientId),
              );
              ensureEmptyNodesEverywhere(draft);
            });

            set({
              editor: newEditor,
              history: [],
              futureHistory: [],
              isLoading: false,
              loadError: null
            });
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error) {
          console.error('Failed to load project tree:', error);
          set({
            isLoading: false,
            loadError: error instanceof Error ? error.message : 'Failed to load project tree'
          });
        }
      },

      applyOperation: (operation, label) => {
        const currentState = get().editor;
        const inverse = getInverseOperation(operation, currentState);

        const newEditor = produce(currentState, draft => {
          applyOperationToState(draft, operation);
          ensureEmptyNodesEverywhere(draft);
        });

        const newHistory = inverse
          ? [...get().history, { operation, inverseOperation: inverse, label }]
          : get().history;

        const needsSync = shouldSyncToBackend(operation);
        const newUnsaved = needsSync
          ? [...get().unsavedOperations, operation]
          : get().unsavedOperations;

        set({
          editor: newEditor,
          history: newHistory,
          futureHistory: [],
          unsavedOperations: newUnsaved,
          autosave: { ...get().autosave, isDirty: needsSync || get().autosave.isDirty }
        });

        if (needsSync) {
          scheduleBackendSave(get().saveToBackend, [operation]);
        }
      },

      undo: () => {
        const { history } = get();
        if (history.length === 0) return;

        const entry = history[history.length - 1];

        const newEditor = produce(get().editor, draft => {
          applyOperationToState(draft, entry.inverseOperation);
          ensureEmptyNodesEverywhere(draft);
        });

        const needsSync = shouldSyncToBackend(entry.inverseOperation);
        const newUnsaved = needsSync
          ? [...get().unsavedOperations, entry.inverseOperation]
          : get().unsavedOperations;

        set({
          editor: newEditor,
          history: history.slice(0, -1),
          futureHistory: [entry, ...get().futureHistory],
          unsavedOperations: newUnsaved,
          autosave: { ...get().autosave, isDirty: needsSync || get().autosave.isDirty }
        });

        if (needsSync) {
          scheduleBackendSave(get().saveToBackend, [entry.inverseOperation]);
        }
      },

      redo: () => {
        const { futureHistory } = get();
        if (futureHistory.length === 0) return;

        const entry = futureHistory[0];

        const newEditor = produce(get().editor, draft => {
          applyOperationToState(draft, entry.operation);
          ensureEmptyNodesEverywhere(draft);
        });

        const needsSync = shouldSyncToBackend(entry.operation);
        const newUnsaved = needsSync
          ? [...get().unsavedOperations, entry.operation]
          : get().unsavedOperations;

        set({
          editor: newEditor,
          history: [...get().history, entry],
          futureHistory: futureHistory.slice(1),
          unsavedOperations: newUnsaved,
          autosave: { ...get().autosave, isDirty: needsSync || get().autosave.isDirty }
        });

        if (needsSync) {
          scheduleBackendSave(get().saveToBackend, [entry.operation]);
        }
      },

      canUndo: () => get().history.length > 0,
      canRedo: () => get().futureHistory.length > 0,

      // ✅ UPDATED: Send chatId in operation batch
      saveToBackend: async () => {
        const { unsavedOperations, autosave } = get();

        if (autosave.isSaving || unsavedOperations.length === 0) return;

        const operationsToSave = [...unsavedOperations];
        clearSaveTimer();

        set(state => ({
          unsavedOperations: [],
          autosave: { ...state.autosave, isSaving: true, saveError: null }
        }));

        try {
          const batch: OperationBatch = {
            operations: operationsToSave,
            batchId: uuidv4(),
            projectId: get().editor.project.id,
            chatId: get().editor.chatId, // ✅ NEW: Include chatId in batch
            timestamp: Date.now()
          };

          const response = await applyOperationBatch(batch);

          if (response?.success) {
            emitTaskOperationsSaved({
              projectId: batch.projectId,
              chatId: batch.chatId,
              operationTypes: operationsToSave.map((operation) => operation.type),
            });

            set({
              autosave: {
                isDirty: get().unsavedOperations.length > 0,
                isSaving: false,
                lastSaveTime: Date.now(),
                saveError: null,
              }
            });

            if (get().unsavedOperations.length > 0) {
              scheduleBackendSave(get().saveToBackend, get().unsavedOperations);
            }
          } else {
            throw new Error('Operation batch failed');
          }
        } catch (error) {
          set(state => ({
            unsavedOperations: [...operationsToSave, ...state.unsavedOperations],
            autosave: {
              ...state.autosave,
              isDirty: true,
              isSaving: false,
              saveError: error instanceof Error ? error.message : 'Save failed',
            }
          }));
        }
      },

      getCurrentRootTasks: () => {
        const { tasks, currentRootTaskId } = get().editor;
        if (currentRootTaskId === null) return tasks;
        const rootTask = findTaskByClientId(tasks, currentRootTaskId);
        return rootTask?.subtasks || [];
      },

      makeRoot: ({ clientId }) => {
        const operation = createSetCurrentRootOp(clientId);
        get().applyOperation(operation, 'makeRoot');

        if (clientId !== null && !get().editor.expandedTasks.has(clientId)) {
          const expandOp = createToggleExpansionOp(clientId, true);
          get().applyOperation(expandOp, 'expandRoot');
        }
      },

      toggleExpansion: ({ clientId }) => {
        const isCurrentlyExpanded = get().editor.expandedTasks.has(clientId);
        const operation = createToggleExpansionOp(clientId, !isCurrentlyExpanded);
        get().applyOperation(operation, 'toggleExpansion');
      },

      toggleCompletion: ({ clientId }) => {
        const task = findTaskByClientId(get().editor.tasks, clientId);
        if (!task || task.isEphemeral) return;

        const operation = createToggleCompletionOp(clientId, !task.isCompleted);
        get().applyOperation(operation, 'toggleCompletion');
        void get().saveToBackend();
      },

      updateTitle: ({ nodeType, title, clientId }) => {
        if (nodeType === 'project') {
          const newEditor = produce(get().editor, draft => {
            draft.project.title = title;
          });
          set({ editor: newEditor });
          return;
        }

        if (!clientId) return;
        const task = findTaskByClientId(get().editor.tasks, clientId);
        if (!task) return;

        if (task.isEphemeral && title.trim() && !task.id) {
          const parent = findParentTask(get().editor.tasks, clientId);
          
          const dueDateFilter = get().editor.dueDateFilter;
          const initialMetadata = {
            ...(dueDateFilter ? { dueDate: calculateDueDateFromFilter(dueDateFilter) } : {}),
            categoryAllocations: normalizeTaskCategoryAllocations(task.categoryAllocations, {
              projectType: get().editor.project.type,
            }),
            lifestyleTraits: normalizeLifestyleTraitAllocations(task.lifestyleTraits),
          };
          
          const createOp = createTaskOp(
            clientId,
            parent?.clientId || null,
            task.position || '',
            initialMetadata
          );
          get().applyOperation(createOp, 'createTask');
        }

        const updateOp = createUpdateTitleOp(clientId, title);
        get().applyOperation(updateOp, 'updateTitle');
      },

      addChild: ({ parentClientId, parentType }) => {
        const newEditor = produce(get().editor, draft => {
          if (parentType === 'task') {
            draft.expandedTasks.add(parentClientId);
          }
          ensureEmptyNodesEverywhere(draft);
        });
        set({ editor: newEditor });
      },

      deleteNode: ({ clientId }) => {
        const task = findTaskByClientId(get().editor.tasks, clientId);
        if (!task?.id || task.isEphemeral) return;

        const operation = createDeleteTaskOp(clientId);
        get().applyOperation(operation, 'deleteNode');
      },

      bulkImportTasks: async ({ parentClientId, parentType, tasks }) => {
        const operations: Operation[] = tasks.map(task => {
          const rootClientId = uuidv4();

          const createSubtreeNode = (item: PendingImportTask, isRoot: boolean = false): SubtreeNode => ({
            clientId: isRoot ? rootClientId : uuidv4(),
            title: item.title || 'Untitled',
            position: '',
            isCompleted: false,
            subtasks: item.subtasks?.map(sub => createSubtreeNode(sub, false))
          });

          return {
            type: 'IMPORT_TASKS',
            rootClientId,
            parentClientId: parentType === 'project' ? null : parentClientId,
            subtree: createSubtreeNode(task, true),
            timestamp: Date.now()
          };
        });

        const newEditor = produce(get().editor, draft => {
          let targetArray: EnhancedTaskTreeType[];
          if (parentType === 'project') {
            targetArray = draft.tasks;
          } else {
            const parent = findTaskByClientId(draft.tasks, parentClientId);
            targetArray = parent?.subtasks || [];
          }

          for (let i = targetArray.length - 1; i >= 0; i--) {
            if (targetArray[i].isEphemeral) {
              targetArray.splice(i, 1);
            }
          }

          operations.forEach(op => applyOperationToState(draft, op));
          if (parentType === 'task') {
            draft.expandedTasks.add(parentClientId);
          }
          ensureEmptyNodesEverywhere(draft);
        });

        set({
          editor: newEditor,
          unsavedOperations: [...get().unsavedOperations, ...operations],
          autosave: { ...get().autosave, isDirty: true }
        });

        await get().saveToBackend();
      },

      updateMetadata: (params) => {
        const { clientId, ...metadata } = params;
        const task = findTaskByClientId(get().editor.tasks, clientId);
        if (!task?.id || task.isEphemeral) return;

        const updates = Object.fromEntries(
          Object.entries(metadata).filter(([_, v]) => v !== undefined)
        );

        if (Object.keys(updates).length === 0) return;

        const operation = createUpdateMetadataOp(clientId, updates);
        get().applyOperation(operation, 'updateMetadata');
      },

      setRecurrence: async ({ clientId, recurrence }) => {
        const task = findTaskByClientId(get().editor.tasks, clientId);
        if (!task?.id || task.isEphemeral) return;

        clearSaveTimer();
        await get().saveToBackend();

        const operation = createSetRecurrenceOp(clientId, recurrence);
        set(state => ({
          autosave: { ...state.autosave, isSaving: true, saveError: null },
        }));

        try {
          const batch: OperationBatch = {
            operations: [operation],
            batchId: uuidv4(),
            projectId: get().editor.project.id,
            chatId: get().editor.chatId,
            timestamp: Date.now(),
          };
          const response = await applyOperationBatch(batch);
          if (!response?.success) throw new Error('Set recurrence failed');

          set(state => ({
            autosave: {
              ...state.autosave,
              isDirty: state.unsavedOperations.length > 0,
              isSaving: false,
              lastSaveTime: Date.now(),
              saveError: null,
            },
          }));
          await get().loadProjectTree();
        } catch (error) {
          set(state => ({
            autosave: {
              ...state.autosave,
              isDirty: true,
              isSaving: false,
              saveError: error instanceof Error ? error.message : 'Set recurrence failed',
            },
          }));
        }
      },
    }))
  );
};

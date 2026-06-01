// treeMutations.ts - All tree operations in one place
import { v4 as uuidv4 } from 'uuid';
import type { EnhancedTaskTreeType, Project, Operation, RecurrenceSchedule, SubtreeNode } from "./types";
import { generatePosition } from "./positionUtils";
import {
  getDefaultTaskCategoryAllocations,
  normalizeLifestyleTraitAllocations,
  normalizeTaskCategoryAllocations,
  type LifestyleTraitAllocation,
  type TaskCategoryAllocation,
} from "@/features/categories/taskCategories";

// ========================================================================
// TYPES
// ========================================================================

export type EditorState = {
  project: Project;
  tasks: EnhancedTaskTreeType[];
  currentRootTaskId: string | null;
  expandedTasks: Set<string>;
  selectionId?: string;
  dueDateFilter?: 'today' | 'tomorrow' | 'this-week'; // ✅ Already added
  chatId?: number; // ✅ NEW: Link state to chat for draft task creation
};

export type HistoryEntry = {
  operation: Operation;
  inverseOperation: Operation;
  label: string;
};

// ========================================================================
// FIND HELPERS
// ========================================================================

export const findTaskByClientId = (
  tasks: EnhancedTaskTreeType[], 
  targetClientId: string
): EnhancedTaskTreeType | null => {
  for (const task of tasks) {
    if (task.clientId === targetClientId) return task;
    if (task.subtasks) {
      const found = findTaskByClientId(task.subtasks, targetClientId);
      if (found) return found;
    }
  }
  return null;
};

export const findParentTask = (
  tasks: EnhancedTaskTreeType[], 
  targetClientId: string
): EnhancedTaskTreeType | null => {
  for (const task of tasks) {
    if (task.subtasks?.some(st => st.clientId === targetClientId)) {
      return task;
    }
    if (task.subtasks) {
      const found = findParentTask(task.subtasks, targetClientId);
      if (found) return found;
    }
  }
  return null;
};

// ========================================================================
// SERIALIZATION
// ========================================================================

const serializeSubtree = (task: EnhancedTaskTreeType): SubtreeNode => {
  return {
    clientId: task.clientId,
    title: task.title || '',
    position: task.position || '',
    isCompleted: task.isCompleted ?? false,
    estimatedTimeMinutes: task.estimatedTimeMinutes,
    dueDate: task.dueDate,
    categoryAllocations: task.categoryAllocations
      ? normalizeTaskCategoryAllocations(task.categoryAllocations)
      : undefined,
    lifestyleTraits: task.lifestyleTraits
      ? normalizeLifestyleTraitAllocations(task.lifestyleTraits)
      : undefined,
    systemType: task.systemType ?? null,
    subtasks: task.subtasks?.flatMap((subtask) => (subtask.isEphemeral ? [] : [serializeSubtree(subtask)]))
  };
};

// ========================================================================
// TREE MANIPULATION
// ========================================================================

const removeTaskFromTree = (tasks: EnhancedTaskTreeType[], clientId: string): boolean => {
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].clientId === clientId) {
      tasks.splice(i, 1);
      return true;
    }
    if (tasks[i].subtasks && removeTaskFromTree(tasks[i].subtasks!, clientId)) {
      return true;
    }
  }
  return false;
};

// ========================================================================
// EMPTY NODE MANAGEMENT
// ========================================================================

const createEmptyTask = (
  draft: EditorState, 
  parentTaskClientId: string | null
): EnhancedTaskTreeType => {
  const parentTask = parentTaskClientId
    ? findTaskByClientId(draft.tasks, parentTaskClientId)
    : null;
  const siblings = parentTaskClientId === null 
    ? draft.tasks 
    : parentTask?.subtasks || [];
  const inheritedCategoryAllocations = parentTask?.categoryAllocations
    ? normalizeTaskCategoryAllocations(parentTask.categoryAllocations, { projectType: draft.project.type })
    : getDefaultTaskCategoryAllocations(draft.project.type);
  const inheritedLifestyleTraits = parentTask?.lifestyleTraits
    ? normalizeLifestyleTraitAllocations(parentTask.lifestyleTraits)
    : [];

  return {
    clientId: uuidv4(),
    title: '',
    isCompleted: false,
    projectId: draft.project.id,
    parentTaskId: parentTaskClientId 
      ? parentTask?.id || null
      : null,
    position: generatePosition(siblings),
    categoryAllocations: inheritedCategoryAllocations,
    lifestyleTraits: inheritedLifestyleTraits,
    systemType: null,
    subtasks: [],
    isEphemeral: true
  };
};

const ensureTrailingEmptyTask = (
  draft: EditorState, 
  parentTaskClientId: string | null
): void => {
  let siblings: EnhancedTaskTreeType[];
  
  if (parentTaskClientId === null) {
    siblings = draft.tasks;
  } else {
    const parent = findTaskByClientId(draft.tasks, parentTaskClientId);
    if (!parent) return;
    siblings = parent.subtasks || [];
  }
  
  const lastTask = siblings[siblings.length - 1];
  const needsEmpty = !lastTask || 
    (!lastTask.isEphemeral || lastTask.title?.trim() !== '' || lastTask.isCompleted);
  
  if (needsEmpty) {
    const emptyTask = createEmptyTask(draft, parentTaskClientId);
    
    if (parentTaskClientId === null) {
      draft.tasks.push(emptyTask);
    } else {
      const parent = findTaskByClientId(draft.tasks, parentTaskClientId);
      if (parent) {
        parent.subtasks = parent.subtasks || [];
        parent.subtasks.push(emptyTask);
      }
    }
  }
};

export const ensureEmptyNodesEverywhere = (draft: EditorState): void => {
  const hasCategoryRoots = draft.tasks.some((task) => task.systemType === "category_root");
  if (!hasCategoryRoots) {
    ensureTrailingEmptyTask(draft, null);
  }
  
  const walkTasks = (tasks: EnhancedTaskTreeType[]) => {
    tasks.forEach(task => {
      if (draft.expandedTasks.has(task.clientId)) {
        ensureTrailingEmptyTask(draft, task.clientId);
      }
      if (task.subtasks) {
        walkTasks(task.subtasks);
      }
    });
  };
  
  walkTasks(draft.tasks);
};

// ========================================================================
// BACKEND SYNC CONFIGURATION
// ========================================================================

const BACKEND_SYNCED_OPERATIONS = new Set([
  'CREATE_TASK',
  'UPDATE_TITLE',
  'TOGGLE_COMPLETE',
  'DELETE_TASK',
  'UPDATE_METADATA',
  'SET_RECURRENCE',
  'IMPORT_TASKS'
]);

export const shouldSyncToBackend = (operation: Operation): boolean => {
  return BACKEND_SYNCED_OPERATIONS.has(operation.type);
};

// ========================================================================
// OPERATION APPLICATION
// ========================================================================

export const applyOperationToState = (draft: EditorState, operation: Operation): void => {
  switch (operation.type) {
    case 'TOGGLE_EXPANSION': {
      const task = findTaskByClientId(draft.tasks, operation.clientId);
      if (!task) return;
      
      if (operation.isExpanded) {
        draft.expandedTasks.add(operation.clientId);
        ensureTrailingEmptyTask(draft, operation.clientId);
      } else {
        draft.expandedTasks.delete(operation.clientId);
      }
      break;
    }
    
    case 'SET_CURRENT_ROOT': {
      if (operation.clientId === null || findTaskByClientId(draft.tasks, operation.clientId)) {
        draft.currentRootTaskId = operation.clientId;
      }
      break;
    }
    
    // ✅ UPDATED CASE - Handle metadata
    case 'CREATE_TASK': {
      const task = findTaskByClientId(draft.tasks, operation.clientId);
      if (task && task.isEphemeral) {
        // Task already exists as ephemeral, just promote it
        task.isEphemeral = false;
        
        // Apply metadata if provided
        if (operation.metadata) {
          if (operation.metadata.dueDate !== undefined) {
            task.dueDate = operation.metadata.dueDate;
          }
          if (operation.metadata.estimatedTimeMinutes !== undefined) {
            task.estimatedTimeMinutes = operation.metadata.estimatedTimeMinutes;
          }
          if (operation.metadata.priority !== undefined) {
            task.priority = operation.metadata.priority;
          }
          if (operation.metadata.categoryAllocations !== undefined) {
            task.categoryAllocations = normalizeTaskCategoryAllocations(operation.metadata.categoryAllocations, {
              projectType: draft.project.type,
            });
          }
          if (operation.metadata.lifestyleTraits !== undefined) {
            task.lifestyleTraits = normalizeLifestyleTraitAllocations(operation.metadata.lifestyleTraits);
          }
          if (operation.metadata.systemType !== undefined) {
            task.systemType = operation.metadata.systemType;
          }
        }
      } else if (!task) {
        // Task doesn't exist at all, create it
        const newTask: EnhancedTaskTreeType = {
          clientId: operation.clientId,
          title: '', // Empty initially - title comes from UPDATE_TITLE
          isCompleted: false,
          projectId: draft.project.id,
          parentTaskId: operation.parentClientId 
            ? findTaskByClientId(draft.tasks, operation.parentClientId)?.id || null 
            : null,
          position: operation.position,
          subtasks: [],
          isEphemeral: false,
          // Apply metadata if provided
          dueDate: operation.metadata?.dueDate ?? null,
          estimatedTimeMinutes: operation.metadata?.estimatedTimeMinutes ?? null,
          priority: operation.metadata?.priority ?? null,
          categoryAllocations: normalizeTaskCategoryAllocations(operation.metadata?.categoryAllocations, {
            projectType: draft.project.type,
          }),
          lifestyleTraits: normalizeLifestyleTraitAllocations(operation.metadata?.lifestyleTraits),
          systemType: operation.metadata?.systemType ?? null,
        };
        
        if (operation.parentClientId === null) {
          draft.tasks.push(newTask);
        } else {
          const parent = findTaskByClientId(draft.tasks, operation.parentClientId);
          if (parent) {
            parent.subtasks = parent.subtasks || [];
            parent.subtasks.push(newTask);
          }
        }
      }
      break;
    }
    
    case 'UPDATE_TITLE': {
      const task = findTaskByClientId(draft.tasks, operation.clientId);
      if (task) {
        task.title = operation.title;
      }
      break;
    }
    
    case 'TOGGLE_COMPLETE': {
      const task = findTaskByClientId(draft.tasks, operation.clientId);
      if (task) {
        task.isCompleted = operation.isCompleted;
      }
      break;
    }
    
    case 'UPDATE_METADATA': {
      const task = findTaskByClientId(draft.tasks, operation.clientId);
      if (task) {
        if ('estimatedTimeMinutes' in operation) {
          task.estimatedTimeMinutes = operation.estimatedTimeMinutes ?? null;
        }
        if ('dueDate' in operation) {
          task.dueDate = operation.dueDate ?? null;
        }
        if ('priority' in operation) {
          task.priority = operation.priority ?? null;
        }
        if ('description' in operation) {
          task.description = operation.description ?? null;
        }
        if ('categoryAllocations' in operation) {
          task.categoryAllocations = normalizeTaskCategoryAllocations(operation.categoryAllocations, {
            projectType: draft.project.type,
          });
        }
        if ('lifestyleTraits' in operation) {
          task.lifestyleTraits = normalizeLifestyleTraitAllocations(operation.lifestyleTraits);
        }
      }
      break;
    }

    case 'SET_RECURRENCE':
      break;
    
    case 'DELETE_TASK': {
      const task = findTaskByClientId(draft.tasks, operation.clientId);
      if (!task) return;
      
      if (draft.currentRootTaskId === operation.clientId) {
        draft.currentRootTaskId = null;
      }
      
      draft.expandedTasks.delete(operation.clientId);
      removeTaskFromTree(draft.tasks, operation.clientId);
      break;
    }
    
    case 'IMPORT_TASKS': {
      const reconstructTask = (subtree: SubtreeNode): EnhancedTaskTreeType => ({
        ...subtree,
        projectId: draft.project.id,
        parentTaskId: null,
        subtasks: subtree.subtasks?.map(reconstructTask),
        categoryAllocations: normalizeTaskCategoryAllocations(subtree.categoryAllocations, {
          projectType: draft.project.type,
        }),
        lifestyleTraits: normalizeLifestyleTraitAllocations(subtree.lifestyleTraits),
        systemType: subtree.systemType ?? null,
        isEphemeral: false
      });
      
      const newTask = reconstructTask(operation.subtree);
      
      if (operation.parentClientId === null) {
        draft.tasks.push(newTask);
      } else {
        const parent = findTaskByClientId(draft.tasks, operation.parentClientId);
        if (parent) {
          parent.subtasks = parent.subtasks || [];
          parent.subtasks.push(newTask);
          draft.expandedTasks.add(operation.parentClientId);
        }
      }
      break;
    }
  }
};

export const getInverseOperation = (
  operation: Operation, 
  currentState: EditorState
): Operation | null => {
  switch (operation.type) {
    case 'TOGGLE_EXPANSION':
      return {
        type: 'TOGGLE_EXPANSION',
        clientId: operation.clientId,
        isExpanded: !operation.isExpanded,
        timestamp: Date.now()
      };
    
    case 'SET_CURRENT_ROOT':
      return {
        type: 'SET_CURRENT_ROOT',
        clientId: currentState.currentRootTaskId,
        timestamp: Date.now()
      };
    
    case 'CREATE_TASK': {
      return {
        type: 'DELETE_TASK',
        clientId: operation.clientId,
        timestamp: Date.now()
      };
    }
    
    case 'UPDATE_TITLE': {
      const task = findTaskByClientId(currentState.tasks, operation.clientId);
      return {
        type: 'UPDATE_TITLE',
        clientId: operation.clientId,
        title: task?.title || '',
        timestamp: Date.now()
      };
    }
    
    case 'TOGGLE_COMPLETE':
      return {
        type: 'TOGGLE_COMPLETE',
        clientId: operation.clientId,
        isCompleted: !operation.isCompleted,
        timestamp: Date.now()
      };
    
    case 'UPDATE_METADATA': {
      const task = findTaskByClientId(currentState.tasks, operation.clientId);
      return {
        type: 'UPDATE_METADATA',
        clientId: operation.clientId,
        estimatedTimeMinutes: task?.estimatedTimeMinutes,
        dueDate: task?.dueDate,
        priority: task?.priority,
        description: task?.description,
        categoryAllocations: normalizeTaskCategoryAllocations(task?.categoryAllocations, {
          projectType: currentState.project.type,
        }),
        lifestyleTraits: normalizeLifestyleTraitAllocations(task?.lifestyleTraits),
        timestamp: Date.now()
      };
    }

    case 'SET_RECURRENCE':
      return null;
    
    case 'DELETE_TASK': {
      const task = findTaskByClientId(currentState.tasks, operation.clientId);
      const parent = findParentTask(currentState.tasks, operation.clientId);
      if (!task) return null;
      
      return {
        type: 'IMPORT_TASKS',
        rootClientId: operation.clientId,
        parentClientId: parent?.clientId || null,
        subtree: serializeSubtree(task),
        timestamp: Date.now()
      };
    }
    
    case 'IMPORT_TASKS':
      return {
        type: 'DELETE_TASK',
        clientId: operation.rootClientId,
        timestamp: Date.now()
      };
  }
};

// ========================================================================
// OPERATION CREATORS - NOW PURE!
// ========================================================================

export const createToggleExpansionOp = (
  clientId: string,
  isExpanded: boolean
): Operation => {
  return {
    type: 'TOGGLE_EXPANSION',
    clientId,
    isExpanded,
    timestamp: Date.now()
  };
};

export const createSetCurrentRootOp = (
  clientId: string | null
): Operation => {
  return {
    type: 'SET_CURRENT_ROOT',
    clientId,
    timestamp: Date.now()
  };
};

export const createTaskOp = (
  clientId: string,
  parentClientId: string | null,
  position: string,
  metadata?: {
    dueDate?: string | null;
    estimatedTimeMinutes?: number | null;
    priority?: number | null;
    categoryAllocations?: TaskCategoryAllocation[];
    lifestyleTraits?: LifestyleTraitAllocation[];
    systemType?: string | null;
  }
): Operation => {
  return {
    type: 'CREATE_TASK',
    clientId,
    parentClientId,
    position,
    metadata, // ✅ Already added
    timestamp: Date.now()
  };
};

export const createUpdateTitleOp = (
  clientId: string,
  title: string
): Operation => {
  return {
    type: 'UPDATE_TITLE',
    clientId,
    title,
    timestamp: Date.now()
  };
};

export const createToggleCompletionOp = (
  clientId: string,
  isCompleted: boolean
): Operation => {
  return {
    type: 'TOGGLE_COMPLETE',
    clientId,
    isCompleted,
    timestamp: Date.now()
  };
};

export const createDeleteTaskOp = (
  clientId: string
): Operation => {
  return {
    type: 'DELETE_TASK',
    clientId,
    timestamp: Date.now()
  };
};

export const createUpdateMetadataOp = (
  clientId: string,
  updates: {
    estimatedTimeMinutes?: number | null;
    dueDate?: string | null;
    priority?: number | null;
    description?: string | null;
    categoryAllocations?: TaskCategoryAllocation[];
    lifestyleTraits?: LifestyleTraitAllocation[];
  }
): Operation => {
  return {
    type: 'UPDATE_METADATA',
    clientId,
    ...updates,
    timestamp: Date.now()
  } as Operation;
};

export const createSetRecurrenceOp = (
  clientId: string,
  recurrence: RecurrenceSchedule,
): Operation => {
  return {
    type: 'SET_RECURRENCE',
    clientId,
    recurrence,
    timestamp: Date.now(),
  };
};

// types.ts - UPDATED WITH CHATID SUPPORT

import type { Project, TaskTreeType } from "../../../types";
import type { LifestyleTraitAllocation, TaskCategoryAllocation } from "@/features/categories/taskCategories";

// ========================================================================
// IMPORT TYPES
// ========================================================================

export interface PendingImportTask {
  title: string;
  subtasks?: PendingImportTask[];
}

export interface RawImportTask {
  id?: string;
  parentTaskId?: string;
  title: string;
  subtasks?: RawImportTask[];
  [key: string]: unknown;
}

// ========================================================================
// OPERATION TYPES FOR BACKEND SYNC
// ========================================================================

export type RecurrenceSchedule =
  | { mode: 'none' }
  | { mode: 'daily'; startDate: string; endDate?: string | null; interval?: number }
  | { mode: 'daily_quota'; startDate: string; endDate?: string | null; targetCount: number; comparator?: 'at_least' }
  | { mode: 'weekdays'; startDate: string; endDate?: string | null }
  | { mode: 'weekly'; startDate: string; endDate?: string | null; interval?: number; weekdays?: number[] }
  | { mode: 'weekly_quota'; startDate: string; endDate?: string | null; targetCount: number; comparator?: 'at_least' };

export type RecurrenceTargetProgress = {
  period: 'day' | 'week';
  targetCount: number;
  completedCount: number;
  localDate: string;
  periodStartDate: string;
  periodEndDateExclusive: string;
};

export type Operation = 
  | { type: 'TOGGLE_EXPANSION'; clientId: string; isExpanded: boolean; timestamp: number }
  | { type: 'SET_CURRENT_ROOT'; clientId: string | null; timestamp: number }
  | { 
    type: 'CREATE_TASK'; 
    clientId: string; 
    parentClientId: string | null; 
    position: string;
    metadata?: {
      dueDate?: string | null;
      estimatedTimeMinutes?: number | null;
      priority?: number | null;
      categoryAllocations?: TaskCategoryAllocation[];
      lifestyleTraits?: LifestyleTraitAllocation[];
      systemType?: string | null;
    };
    timestamp: number;
  }
  | { type: 'UPDATE_TITLE'; clientId: string; title: string; timestamp: number }
  | { type: 'TOGGLE_COMPLETE'; clientId: string; isCompleted: boolean; timestamp: number }
  | { type: 'ADD_RECURRENCE_TARGET_COMPLETION'; clientId: string; sourceClientId?: string; localDate: string; quantity: number; clientEventId: string; timestamp: number }
  | { type: 'DELETE_TASK'; clientId: string; timestamp: number }
  | { 
      type: 'UPDATE_METADATA'; 
      clientId: string; 
      estimatedTimeMinutes?: number | null;
      dueDate?: string | null;
      priority?: number | null;
      description?: string | null;
      categoryAllocations?: TaskCategoryAllocation[];
      lifestyleTraits?: LifestyleTraitAllocation[];
      timestamp: number;
    }
  | { type: 'SET_RECURRENCE'; clientId: string; recurrence: RecurrenceSchedule; timestamp: number }
  | { type: 'IMPORT_TASKS'; rootClientId: string; parentClientId: string | null; subtree: SubtreeNode; timestamp: number };

export type SubtreeNode = {
  clientId: string;
  title: string;
  position: string;
  isCompleted: boolean;
  estimatedTimeMinutes?: number | null;
  dueDate?: string | null;
  priority?: number | null;
  description?: string | null;
  categoryAllocations?: TaskCategoryAllocation[];
  lifestyleTraits?: LifestyleTraitAllocation[];
  systemType?: string | null;
  subtasks?: SubtreeNode[];
};

export type OperationBatch = {
  operations: Operation[];
  batchId: string;
  projectId: number;
  chatId?: number; // ✅ NEW: Link batch to chat for draft task creation
  timestamp: number;
};

// ========================================================================
// ENHANCED BACKEND TYPES WITH CLIENT ID AND POSITION SUPPORT
// ========================================================================

export interface EnhancedTaskTreeType extends Omit<TaskTreeType, 'id' | 'subtasks'> {
  clientId: string;
  id?: number;
  subtasks?: EnhancedTaskTreeType[];
  isEphemeral?: boolean;
}

// ========================================================================
// CORE TREE TYPES
// ========================================================================

export interface TreeNode {
  id: string;
  title: string | undefined;
  isCompleted: boolean;
  isExpanded: boolean;
  children?: TreeNode[];
  nodeType: 'project' | 'task';
  originalId?: number | string;
  originalType?: 'project' | 'task';
  
  estimatedTimeMinutes?: number | null;
  dueDate?: string | null;
  originalDueDate?: string | null;
  rolloverHistory?: string | null;
  categoryAllocations?: TaskCategoryAllocation[];
  lifestyleTraits?: LifestyleTraitAllocation[];
  systemType?: string | null;
  recurrenceSeriesId?: number | null;
  recurrenceRole?: 'template' | 'occurrence_root' | 'occurrence_child' | null;
  recurrenceTemplateTaskId?: number | null;
  recurrenceOccurrenceDate?: string | null;
  recurrenceStatus?: 'scheduled' | 'skipped' | null;
  recurrenceIsOverride?: number | boolean | null;
  recurrenceSchedule?: RecurrenceSchedule | null;
  recurrenceTargetProgress?: RecurrenceTargetProgress | null;
  recurrenceTargetTaskClientId?: string | null;
  taskId?: number;
  isEphemeral?: boolean;
  position?: string;
}

export interface VisibleNode extends TreeNode {
  depth: number;
  parentPath: string[];
  hasChildren: boolean;
  isExpanded: boolean;
}

export type { Project, TaskTreeType };

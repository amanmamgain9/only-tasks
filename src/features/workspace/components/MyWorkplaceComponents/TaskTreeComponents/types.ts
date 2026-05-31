// types.ts - UPDATED WITH CHATID SUPPORT

import type { Project, TaskTreeType } from "../../../types";
import type { TaskCategoryAllocation } from "@/features/categories/taskCategories";

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
    };
    timestamp: number;
  }
  | { type: 'UPDATE_TITLE'; clientId: string; title: string; timestamp: number }
  | { type: 'TOGGLE_COMPLETE'; clientId: string; isCompleted: boolean; timestamp: number }
  | { type: 'DELETE_TASK'; clientId: string; timestamp: number }
  | { 
      type: 'UPDATE_METADATA'; 
      clientId: string; 
      estimatedTimeMinutes?: number | null;
      dueDate?: string | null;
      priority?: number | null;
      description?: string | null;
      categoryAllocations?: TaskCategoryAllocation[];
      timestamp: number;
    }
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
  categoryAllocations?: TaskCategoryAllocation[];
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

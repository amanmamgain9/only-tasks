// treeAdapter.ts - Pure data transformation functions with clientId-first approach
import { Project } from '../../../types';
import { TreeNode, VisibleNode, EnhancedTaskTreeType } from './types';
import { INITIAL_POSITION } from './positionUtils';
import { normalizeLifestyleTraitAllocations, normalizeTaskCategoryAllocations } from '@/features/categories/taskCategories';

// ========================================================================
// HELPER FUNCTIONS
// ========================================================================

const findTaskById = (tasks: EnhancedTaskTreeType[], targetId: number): EnhancedTaskTreeType | null => {
  for (const task of tasks) {
    if (task.id === targetId) return task;
    
    if (task.subtasks) {
      const found = findTaskById(task.subtasks, targetId);
      if (found) return found;
    }
  }
  return null;
};

export const findTaskByClientId = (tasks: EnhancedTaskTreeType[], targetClientId: string): EnhancedTaskTreeType | null => {
  for (const task of tasks) {
    if (task.clientId === targetClientId) return task;
    
    if (task.subtasks) {
      const found = findTaskByClientId(task.subtasks, targetClientId);
      if (found) return found;
    }
  }
  return null;
};

const hasActualChildren = (taskClientId: string, tasks: EnhancedTaskTreeType[]): boolean => {
  const task = findTaskByClientId(tasks, taskClientId);
  if (!task) return false;

  // Check for subtasks
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;

  return !!hasSubtasks;
};

// ========================================================================
// TREE COMPUTATION FUNCTIONS
// ========================================================================

export const computeTreeNodes = (
  tasks: EnhancedTaskTreeType[], 
  expandedTasks: Set<string>, 
  project: Project,
  currentRootTaskId: string | null
): TreeNode[] => {
  const rootNodes: TreeNode[] = [];

  // If at project root, show all top-level tasks
  if (currentRootTaskId === null) {
    // Sort by position
    const sortedTasks = tasks.toSorted((a, b) => {
      const posA = a.position || INITIAL_POSITION;
      const posB = b.position || INITIAL_POSITION;
      return posA.localeCompare(posB);
    });
    
    sortedTasks.forEach(task => {
      const taskNode = taskToTreeNode(task, expandedTasks, project.type);
      rootNodes.push(taskNode);
    });
    return rootNodes;
  }

  // Find the root task and show its children
  const rootTask = findTaskByClientId(tasks, currentRootTaskId);
  if (rootTask) {
    const children: TreeNode[] = [];

    // Add subtasks with their positions, sort by position
    if (rootTask.subtasks) {
      const sortedSubtasks = rootTask.subtasks.toSorted((a, b) => {
        const posA = a.position || INITIAL_POSITION;
        const posB = b.position || INITIAL_POSITION;
        return posA.localeCompare(posB);
      });

      sortedSubtasks.forEach(subtask => {
        children.push(taskToTreeNode(subtask, expandedTasks, project.type));
      });
    }

    rootNodes.push(...children);
  }

  return rootNodes;
};

const taskToTreeNode = (
  task: EnhancedTaskTreeType, 
  expandedTasks: Set<string>,
  projectType: Project["type"],
): TreeNode => {
  const isExpanded = expandedTasks.has(task.clientId);
  const children: TreeNode[] = [];

  // Only build children array if expanded
  if (isExpanded && task.subtasks) {
    const sortedSubtasks = task.subtasks.toSorted((a, b) => {
      const posA = a.position || INITIAL_POSITION;
      const posB = b.position || INITIAL_POSITION;
      return posA.localeCompare(posB);
    });

    sortedSubtasks.forEach(subtask => {
      children.push(taskToTreeNode(subtask, expandedTasks, projectType));
    });
  }

  return {
    id: task.clientId,
    title: task.title,
    isCompleted: task.isCompleted || false,
    isExpanded,
    nodeType: 'task',
    originalType: 'task',
    originalId: task.id,
    estimatedTimeMinutes: task.estimatedTimeMinutes,
    dueDate: task.dueDate,
    categoryAllocations: normalizeTaskCategoryAllocations(task.categoryAllocations, { projectType }),
    lifestyleTraits: normalizeLifestyleTraitAllocations(task.lifestyleTraits),
    systemType: task.systemType ?? null,
    recurrenceSeriesId: task.recurrenceSeriesId ?? null,
    recurrenceRole: task.recurrenceRole ?? null,
    recurrenceTemplateTaskId: task.recurrenceTemplateTaskId ?? null,
    recurrenceOccurrenceDate: task.recurrenceOccurrenceDate ?? null,
    recurrenceStatus: task.recurrenceStatus ?? null,
    recurrenceIsOverride: task.recurrenceIsOverride ?? null,
    position: task.position,
    children: children.length > 0 ? children : undefined,
    taskId: task.id,
    isEphemeral: task.isEphemeral || false
  };
};

export const computeVisibleNodes = (
  treeNodes: TreeNode[], 
  tasks: EnhancedTaskTreeType[],
  depth = 0,
  parentPath: string[] = []
): VisibleNode[] => {
  const visible: VisibleNode[] = [];

  treeNodes.forEach(node => {
    const visibleNode: VisibleNode = {
      ...node,
      depth,
      parentPath,
      hasChildren: node.nodeType === 'task' && hasActualChildren(node.id, tasks),
      isExpanded: node.isExpanded || false
    };

    visible.push(visibleNode);

    // If expanded and has children, recursively add them
    if (node.isExpanded && node.children) {
      const childVisible = computeVisibleNodes(node.children, tasks, depth + 1, [...parentPath, node.id]);
      visible.push(...childVisible);
    }
  });

  return visible;
};

export const computeBreadcrumbs = (
  tasks: EnhancedTaskTreeType[], 
  currentRootTaskId: string | null,
  project: Project
): Array<{ id: string; title: string }> => {
  const breadcrumbs: Array<{ id: string; title: string }> = [];

  // Always start with project
  breadcrumbs.push({
    id: `project-${project.id}`,
    title: project.title
  });

  // If we're at a task root, build path to that task
  if (currentRootTaskId !== null) {
    const path = findTaskPathByClientId(tasks, currentRootTaskId);
    if (path) {
      let current = tasks;
      for (const index of path) {
        const task = current[index];
        if (task && task.title !== undefined) {
          breadcrumbs.push({
            id: task.clientId,
            title: task.title
          });
          current = task.subtasks || [];
        }
      }
    }
  }

  return breadcrumbs;
};

const findTaskPath = (tasks: EnhancedTaskTreeType[], targetId: number, path: number[] = []): number[] | null => {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const currentPath = [...path, i];
    
    if (task.id === targetId) return currentPath;
    
    if (task.subtasks) {
      const found = findTaskPath(task.subtasks, targetId, currentPath);
      if (found) return found;
    }
  }
  return null;
};

const findTaskPathByClientId = (tasks: EnhancedTaskTreeType[], targetClientId: string, path: number[] = []): number[] | null => {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const currentPath = [...path, i];
    
    if (task.clientId === targetClientId) return currentPath;
    
    if (task.subtasks) {
      const found = findTaskPathByClientId(task.subtasks, targetClientId, currentPath);
      if (found) return found;
    }
  }
  return null;
};

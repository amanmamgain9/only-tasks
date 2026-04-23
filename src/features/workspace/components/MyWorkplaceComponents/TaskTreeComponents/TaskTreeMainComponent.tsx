// TreeMain.tsx - COMPLETE FILE WITH CHATID SUPPORT
import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { FileJson } from 'lucide-react';
import TreeNodeComponent from './TreeNodeComponent';
import Breadcrumb from './Breadcrumb';
import ConfirmModal from './ConfirmModal';
import ImportTasksModal from './ImportTasksModal';
import ScheduleModal from './ScheduleModal';
import { Project } from '../../../types';
import { VisibleNode, PendingImportTask } from './types';
import { createEditorStore } from './useTree';
import {
  computeTreeNodes,
  computeVisibleNodes,
  computeBreadcrumbs,
  findTaskByClientId
} from './treeAdapter';
import { NavigationService } from '../../../_services/navigationService';

interface Props {
  project: Project;
  dueDateFilter?: 'today' | 'tomorrow' | 'this-week';
  chatId?: number; // ✅ NEW: Filter tasks by chat
}

export default function TreeMain({ project, dueDateFilter, chatId }: Props) { // ✅ UPDATED: Destructure chatId
  const containerRef = useRef<HTMLDivElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    node: VisibleNode;
    nodeIndex: number;
  } | null>(null);
  const [scheduleNode, setScheduleNode] = useState<VisibleNode | null>(null);

  // ✅ UPDATED: Pass chatId to store creator and add to dependencies
  const useStore = useMemo(
    () => createEditorStore(project, dueDateFilter, chatId), 
    [project, dueDateFilter, chatId]
  );

  const loadProjectTree = useStore(s => s.loadProjectTree);
  const isLoading = useStore(s => s.isLoading);
  const loadError = useStore(s => s.loadError);

  useEffect(() => {
    loadProjectTree();
  }, [loadProjectTree]);

  const tasks = useStore(s => s.editor.tasks);
  const currentRootTaskId = useStore(s => s.editor.currentRootTaskId);
  const expandedTasks = useStore(s => s.editor.expandedTasks);
  const projectData = useStore(s => s.editor.project);

  const toggleExpansion = useStore(s => s.toggleExpansion);
  const toggleCompletion = useStore(s => s.toggleCompletion);
  const updateTitle = useStore(s => s.updateTitle);
  const addChildAction = useStore(s => s.addChild);
  const deleteNodeAction = useStore(s => s.deleteNode);
  const makeRoot = useStore(s => s.makeRoot);
  const bulkImportTasks = useStore(s => s.bulkImportTasks);
  const updateMetadata = useStore(s => s.updateMetadata);

  const treeNodes = useMemo(
    () => computeTreeNodes(tasks, expandedTasks, projectData, currentRootTaskId),
    [tasks, expandedTasks, projectData, currentRootTaskId]
  );

  const visibleNodes = useMemo(
    () => computeVisibleNodes(treeNodes, tasks),
    [treeNodes, tasks]
  );

  const breadcrumbs = useMemo(
    () => computeBreadcrumbs(tasks, currentRootTaskId, projectData),
    [tasks, currentRootTaskId, projectData]
  );

  const currentRootNode = useMemo(() => {
    if (currentRootTaskId === null) {
      return {
        id: `project-${projectData.id}`,
        title: projectData.title,
        isCompleted: projectData.status === 'completed',
        isExpanded: true,
        nodeType: 'project' as const,
        originalType: 'project' as const,
        originalId: projectData.id,
      };
    } else {
      const task = findTaskByClientId(tasks, currentRootTaskId);
      if (task) {
        return {
          id: task.clientId,
          title: task.title,
          isCompleted: task.isCompleted || false,
          isExpanded: true,
          nodeType: 'task' as const,
          originalType: 'task' as const,
          originalId: task.id,
          estimatedTimeMinutes: task.estimatedTimeMinutes,
          dueDate: task.dueDate,
        };
      }
    }
    return null;
  }, [tasks, currentRootTaskId, projectData]);

  const hasBreadcrumbs = breadcrumbs.length > 1;
  const nodesContainerIndex = hasBreadcrumbs ? 1 : 0;

  const escapeAttributeValue = useCallback((value: string) => {
    return typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/["\\]/g, '\\$&');
  }, []);

  const handleToggleExpansion = useCallback((node: VisibleNode) => {
    if (node.nodeType === 'task') {
      toggleExpansion({ clientId: node.id });
    }
  }, [toggleExpansion]);

  const handleToggleCompletion = useCallback((node: VisibleNode) => {
    toggleCompletion({ clientId: node.id });
  }, [toggleCompletion]);

  const handleUpdateTitle = useCallback((node: VisibleNode, title: string) => {
    updateTitle({ nodeType: node.nodeType, title, clientId: node.id });
  }, [updateTitle]);

  const handleMakeRoot = useCallback((node: VisibleNode) => {
    if (node.nodeType === 'task') {
      makeRoot({ clientId: node.id });

      NavigationService.focusBySelector({
        regionId: 'workspace-region',
        selector: `[data-breadcrumb-id="${escapeAttributeValue(node.id)}"]`
      }, true);
    }
  }, [escapeAttributeValue, makeRoot]);

  const handleNavigateToBreadcrumb = useCallback((nodeId: string) => {
    if (nodeId.startsWith('project-')) {
      makeRoot({ clientId: null });

      NavigationService.focusBySelector({
        regionId: 'workspace-region',
        selector: '[data-node-id] [data-entrypoint-focus]'
      }, true);
    } else {
      makeRoot({ clientId: nodeId });

      NavigationService.focusBySelector({
        regionId: 'workspace-region',
        selector: `[data-breadcrumb-id="${escapeAttributeValue(nodeId)}"]`
      }, true);
    }
  }, [escapeAttributeValue, makeRoot]);

  const handleDeleteRequest = useCallback((nodeIndex: number) => {
    const node = visibleNodes[nodeIndex];
    setDeleteConfirm({ node, nodeIndex });
  }, [visibleNodes]);

  const handleConfirmDelete = useCallback(() => {
    if (deleteConfirm) {
      const { node } = deleteConfirm;

      deleteNodeAction({ clientId: node.id });
      setDeleteConfirm(null);

      NavigationService.focusByPath({
        regionId: 'workspace-region',
        path: [0, 0, 2, nodesContainerIndex, 0, 3]
      }, true);
    }
  }, [deleteConfirm, deleteNodeAction, nodesContainerIndex]);

  const handleCancelDelete = useCallback(() => {
    if (deleteConfirm) {
      const nodeIndex = visibleNodes.findIndex(n => n.id === deleteConfirm.node.id);
      if (nodeIndex >= 0) {
        NavigationService.focusByPath({
          regionId: 'workspace-region',
          path: [0, 0, 2, nodesContainerIndex, nodeIndex, 3]
        }, false);
      }
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, visibleNodes, nodesContainerIndex]);

  const handleAddChild = useCallback((parentNodeIndex: number) => {
    const parentNode = visibleNodes[parentNodeIndex];

    let parentType: 'project' | 'task';
    if (parentNode.id.startsWith('project-')) {
      parentType = 'project';
    } else if (parentNode.nodeType === 'task') {
      parentType = 'task';
    } else {
      return;
    }

    addChildAction({ parentClientId: parentNode.id, parentType });

    const nextIndex = parentNodeIndex + 1;

    NavigationService.focusByPath({
      regionId: 'workspace-region',
      path: [0, 0, 2, nodesContainerIndex, nextIndex, 1]
    }, true);
  }, [visibleNodes, addChildAction, nodesContainerIndex]);

  const handleCommitTasks = useCallback(async (importedTasks: PendingImportTask[]) => {
    const parentClientId = currentRootTaskId || `project-${projectData.id}`;
    const parentType = currentRootTaskId ? 'task' : 'project';

    await bulkImportTasks({ parentClientId, parentType, tasks: importedTasks });
  }, [currentRootTaskId, projectData.id, bulkImportTasks]);

  const handleCalendarClick = useCallback((nodeIndex: number) => {
    requestAnimationFrame(() => {
      setScheduleNode(visibleNodes[nodeIndex]);
    });
  }, [visibleNodes]);

  const handleScheduleSave = useCallback((data: {
    dueDate: string | null
  }) => {
    if (!scheduleNode) return;

    updateMetadata({
      clientId: scheduleNode.id,
      dueDate: data.dueDate
    });

    setScheduleNode(null);
  }, [scheduleNode, updateMetadata]);

  const handleScheduleClose = useCallback(() => {
    setScheduleNode(null);
  }, []);

  const nodeComponents = visibleNodes.map((node, index) => (
    <TreeNodeComponent
      key={node.id}
      node={node}
      nodeIndex={index}
      depth={node.depth}
      hasChildren={node.hasChildren}
      isExpanded={node.isExpanded || false}
      tasks={tasks}
      onToggleExpansion={handleToggleExpansion}
      onToggleCompletion={handleToggleCompletion}
      onMakeRoot={handleMakeRoot}
      onAddChild={handleAddChild}
      onUpdateTitle={handleUpdateTitle}
      onDeleteRequest={handleDeleteRequest}
      onCalendarClick={handleCalendarClick}
    />
  ));

  const breadcrumbComponent = breadcrumbs.length <= 1 ? null : (
    <Breadcrumb
      key={currentRootTaskId || 'project'}
      breadcrumbs={breadcrumbs}
      onNavigate={handleNavigateToBreadcrumb}
    />
  );

  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-gray-900 p-6">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Loading project tree...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full bg-white dark:bg-gray-900 p-6">
        <div className="text-center">
          <p className="text-red-500">Failed to load project tree: {loadError}</p>
          <button
            onClick={() => loadProjectTree()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full bg-white dark:bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {currentRootNode?.title || 'Project Tasks'}
        </h2>
        {/* Hide Import button for due date views and chat views */}
        {!dueDateFilter && !chatId && ( // ✅ UPDATED: Also hide in chat view
          <button
            data-tab-only
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FileJson className="w-4 h-4" />
            Import Tasks
          </button>
        )}
      </div>

      <div data-layout="vertical">
        {breadcrumbComponent && (
          <div data-order="0">
            {breadcrumbComponent}
          </div>
        )}

        <div data-order={hasBreadcrumbs ? "1" : "0"}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            data-layout="vertical"
          >
            {nodeComponents}

            {visibleNodes.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>
                  {dueDateFilter
                    ? `No tasks scheduled for ${dueDateFilter === 'this-week' ? 'this week' : dueDateFilter}`
                    : 'No items at this level'
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Task"
          message={`Are you sure you want to delete "${deleteConfirm.node.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}

      {!dueDateFilter && !chatId && ( // ✅ UPDATED: Also hide in chat view
        <ImportTasksModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onCommit={handleCommitTasks}
        />
      )}

      <ScheduleModal
        key={scheduleNode?.id || 'empty'}
        isOpen={scheduleNode !== null}
        onClose={handleScheduleClose}
        onSave={handleScheduleSave}
        initialDueDate={scheduleNode?.dueDate || null}
      />
    </div>
  );
}

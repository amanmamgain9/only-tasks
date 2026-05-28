// TreeMain.tsx - COMPLETE FILE WITH CHATID SUPPORT
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileJson } from 'lucide-react';
import TreeNodeComponent from './TreeNodeComponent';
import Breadcrumb from './Breadcrumb';
import ConfirmModal from './ConfirmModal';
import ImportTasksModal from './ImportTasksModal';
import ScheduleModal from './ScheduleModal';
import { Project } from '../../../types';
import { PendingImportTask, VisibleNode } from './types';
import { createEditorStore } from './useTree';
import {
  computeBreadcrumbs,
  computeTreeNodes,
  computeVisibleNodes,
  findTaskByClientId,
} from './treeAdapter';
import { NavigationService } from '../../../_services/navigationService';

interface Props {
  project: Project;
  dueDateFilter?: 'today' | 'tomorrow' | 'this-week';
  chatId?: number;
}

function getRootNode(projectData: Project, tasks: any[], currentRootTaskId: string | null) {
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
  }

  const task = findTaskByClientId(tasks as any[], currentRootTaskId);
  if (!task) return null;
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

function useTreeMainController({ project, dueDateFilter, chatId }: Props) {
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ node: VisibleNode; nodeIndex: number } | null>(null);
  const [scheduleNode, setScheduleNode] = useState<VisibleNode | null>(null);
  const useStore = useMemo(() => createEditorStore(project, dueDateFilter, chatId), [project, dueDateFilter, chatId]);

  const loadProjectTree = useStore((state) => state.loadProjectTree);
  const isLoading = useStore((state) => state.isLoading);
  const loadError = useStore((state) => state.loadError);
  const tasks = useStore((state) => state.editor.tasks);
  const currentRootTaskId = useStore((state) => state.editor.currentRootTaskId);
  const expandedTasks = useStore((state) => state.editor.expandedTasks);
  const projectData = useStore((state) => state.editor.project);
  const toggleExpansion = useStore((state) => state.toggleExpansion);
  const toggleCompletion = useStore((state) => state.toggleCompletion);
  const updateTitle = useStore((state) => state.updateTitle);
  const addChildAction = useStore((state) => state.addChild);
  const deleteNodeAction = useStore((state) => state.deleteNode);
  const makeRoot = useStore((state) => state.makeRoot);
  const bulkImportTasks = useStore((state) => state.bulkImportTasks);
  const updateMetadata = useStore((state) => state.updateMetadata);

  useEffect(() => {
    loadProjectTree();
  }, [loadProjectTree]);

  const treeNodes = useMemo(
    () => computeTreeNodes(tasks, expandedTasks, projectData, currentRootTaskId),
    [tasks, expandedTasks, projectData, currentRootTaskId],
  );
  const visibleNodes = useMemo(() => computeVisibleNodes(treeNodes, tasks), [treeNodes, tasks]);
  const breadcrumbs = useMemo(
    () => computeBreadcrumbs(tasks, currentRootTaskId, projectData),
    [tasks, currentRootTaskId, projectData],
  );
  const currentRootNode = useMemo(
    () => getRootNode(projectData, tasks as any[], currentRootTaskId),
    [currentRootTaskId, projectData, tasks],
  );
  const hasBreadcrumbs = breadcrumbs.length > 1;
  const nodesContainerIndex = hasBreadcrumbs ? 1 : 0;
  const showImportAction = !dueDateFilter && !chatId;

  const escapeAttributeValue = useCallback((value: string) => (
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(value)
      : value.replace(/["\\]/g, '\\$&')
  ), []);

  const focusNodeAction = useCallback((nodeIndex: number, actionIndex: number, shouldScroll = true) => {
    NavigationService.focusByPath({
      regionId: 'workspace-region',
      path: [0, 0, 2, nodesContainerIndex, nodeIndex, actionIndex],
    }, shouldScroll);
  }, [nodesContainerIndex]);

  const handleToggleExpansion = useCallback((node: VisibleNode) => {
    if (node.nodeType === 'task') toggleExpansion({ clientId: node.id });
  }, [toggleExpansion]);

  const handleToggleCompletion = useCallback((node: VisibleNode) => {
    toggleCompletion({ clientId: node.id });
  }, [toggleCompletion]);

  const handleUpdateTitle = useCallback((node: VisibleNode, title: string) => {
    updateTitle({ nodeType: node.nodeType, title, clientId: node.id });
  }, [updateTitle]);

  const handleMakeRoot = useCallback((node: VisibleNode) => {
    if (node.nodeType !== 'task') return;
    makeRoot({ clientId: node.id });
    NavigationService.focusBySelector({
      regionId: 'workspace-region',
      selector: `[data-breadcrumb-id="${escapeAttributeValue(node.id)}"]`,
    }, true);
  }, [escapeAttributeValue, makeRoot]);

  const handleNavigateToBreadcrumb = useCallback((nodeId: string) => {
    if (nodeId.startsWith('project-')) {
      makeRoot({ clientId: null });
      NavigationService.focusBySelector({
        regionId: 'workspace-region',
        selector: '[data-node-id] [data-entrypoint-focus]',
      }, true);
      return;
    }

    makeRoot({ clientId: nodeId });
    NavigationService.focusBySelector({
      regionId: 'workspace-region',
      selector: `[data-breadcrumb-id="${escapeAttributeValue(nodeId)}"]`,
    }, true);
  }, [escapeAttributeValue, makeRoot]);

  const handleDeleteRequest = useCallback((nodeIndex: number) => {
    const node = visibleNodes[nodeIndex];
    if (node) setDeleteConfirm({ node, nodeIndex });
  }, [visibleNodes]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirm) return;
    deleteNodeAction({ clientId: deleteConfirm.node.id });
    setDeleteConfirm(null);
    focusNodeAction(0, 3);
  }, [deleteConfirm, deleteNodeAction, focusNodeAction]);

  const handleCancelDelete = useCallback(() => {
    if (deleteConfirm) {
      const nodeIndex = visibleNodes.findIndex((node) => node.id === deleteConfirm.node.id);
      if (nodeIndex >= 0) focusNodeAction(nodeIndex, 3, false);
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, focusNodeAction, visibleNodes]);

  const handleAddChild = useCallback((parentNodeIndex: number) => {
    const parentNode = visibleNodes[parentNodeIndex];
    if (!parentNode) return;

    const parentType = parentNode.id.startsWith('project-') ? 'project' : parentNode.nodeType;
    if (parentType !== 'project' && parentType !== 'task') return;

    addChildAction({ parentClientId: parentNode.id, parentType });
    focusNodeAction(parentNodeIndex + 1, 1);
  }, [addChildAction, focusNodeAction, visibleNodes]);

  const handleCommitTasks = useCallback(async (importedTasks: PendingImportTask[]) => {
    const parentClientId = currentRootTaskId || `project-${projectData.id}`;
    const parentType = currentRootTaskId ? 'task' : 'project';
    await bulkImportTasks({ parentClientId, parentType, tasks: importedTasks });
  }, [bulkImportTasks, currentRootTaskId, projectData.id]);

  const handleCalendarClick = useCallback((nodeIndex: number) => {
    requestAnimationFrame(() => {
      setScheduleNode(visibleNodes[nodeIndex] ?? null);
    });
  }, [visibleNodes]);

  const handleScheduleSave = useCallback((data: { dueDate: string | null }) => {
    if (!scheduleNode) return;
    updateMetadata({ clientId: scheduleNode.id, dueDate: data.dueDate });
    setScheduleNode(null);
  }, [scheduleNode, updateMetadata]);

  return {
    breadcrumbs,
    chatId,
    currentRootNode,
    currentRootTaskId,
    deleteConfirm,
    dueDateFilter,
    handleAddChild,
    handleCalendarClick,
    handleCancelDelete,
    handleCommitTasks,
    handleConfirmDelete,
    handleDeleteRequest,
    handleMakeRoot,
    handleNavigateToBreadcrumb,
    handleScheduleSave,
    handleToggleCompletion,
    handleToggleExpansion,
    handleUpdateTitle,
    hasBreadcrumbs,
    isLoading,
    loadError,
    loadProjectTree,
    scheduleNode,
    setScheduleNode,
    setShowImportModal,
    showImportAction,
    showImportModal,
    tasks,
    visibleNodes,
  };
}

function TreeMainLoading() {
  return (
    <div className="w-full bg-white p-6 dark:bg-gray-900">
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400">Loading project tree</p>
      </div>
    </div>
  );
}

function TreeMainError({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="w-full bg-white p-6 dark:bg-gray-900">
      <div className="text-center">
        <p className="text-red-500">Failed to load project tree: {error}</p>
        <button type="button" onClick={onRetry} className="mt-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
          Retry
        </button>
      </div>
    </div>
  );
}

function TreeMainHeader({
  title,
  showImportAction,
  onImport,
}: {
  title: string;
  showImportAction: boolean;
  onImport: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {showImportAction && (
        <button type="button" data-tab-only onClick={onImport} className="flex items-center gap-2 rounded border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700">
          <FileJson className="size-4" />
          Import Tasks
        </button>
      )}
    </div>
  );
}

function TreeNodesPanel({ controller }: { controller: ReturnType<typeof useTreeMainController> }) {
  const nodeComponents = controller.visibleNodes.map((node, index) => (
    <TreeNodeComponent
      key={node.id}
      node={node}
      nodeIndex={index}
      depth={node.depth}
      hasChildren={node.hasChildren}
      isExpanded={node.isExpanded || false}
      tasks={controller.tasks}
      onToggleExpansion={controller.handleToggleExpansion}
      onToggleCompletion={controller.handleToggleCompletion}
      onMakeRoot={controller.handleMakeRoot}
      onAddChild={controller.handleAddChild}
      onUpdateTitle={controller.handleUpdateTitle}
      onDeleteRequest={controller.handleDeleteRequest}
      onCalendarClick={controller.handleCalendarClick}
    />
  ));

  return (
    <div data-order={controller.hasBreadcrumbs ? '1' : '0'}>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" data-layout="vertical">
        {nodeComponents}
        {controller.visibleNodes.length === 0 && (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            <p>
              {controller.dueDateFilter
                ? `No tasks scheduled for ${controller.dueDateFilter === 'this-week' ? 'this week' : controller.dueDateFilter}`
                : 'No items at this level'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeMainModals({ controller }: { controller: ReturnType<typeof useTreeMainController> }) {
  return (
    <>
      {controller.deleteConfirm && (
        <ConfirmModal
          title="Delete Task"
          message={`Are you sure you want to delete "${controller.deleteConfirm.node.title}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={controller.handleConfirmDelete}
          onCancel={controller.handleCancelDelete}
        />
      )}

      {controller.showImportAction && (
        <ImportTasksModal
          isOpen={controller.showImportModal}
          onClose={() => controller.setShowImportModal(false)}
          onCommit={controller.handleCommitTasks}
        />
      )}

      <ScheduleModal
        key={controller.scheduleNode?.id || 'empty'}
        isOpen={controller.scheduleNode !== null}
        onClose={() => controller.setScheduleNode(null)}
        onSave={controller.handleScheduleSave}
        initialDueDate={controller.scheduleNode?.dueDate || null}
      />
    </>
  );
}

export default function TreeMain(props: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controller = useTreeMainController(props);

  if (controller.isLoading) return <TreeMainLoading />;
  if (controller.loadError) return <TreeMainError error={controller.loadError} onRetry={controller.loadProjectTree} />;

  const breadcrumbComponent = controller.breadcrumbs.length <= 1 ? null : (
    <Breadcrumb
      key={controller.currentRootTaskId || 'project'}
      breadcrumbs={controller.breadcrumbs}
      onNavigate={controller.handleNavigateToBreadcrumb}
    />
  );

  return (
    <div ref={containerRef} className="w-full bg-white dark:bg-gray-900">
      <TreeMainHeader
        title={controller.currentRootNode?.title || 'Project Tasks'}
        showImportAction={controller.showImportAction}
        onImport={() => controller.setShowImportModal(true)}
      />

      <div data-layout="vertical">
        {breadcrumbComponent && <div data-order="0">{breadcrumbComponent}</div>}
        <TreeNodesPanel controller={controller} />
      </div>

      <TreeMainModals controller={controller} />
    </div>
  );
}

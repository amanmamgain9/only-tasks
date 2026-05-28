// MyWorkdayTasksComponent.tsx - COMPLETE FILE WITH CHATID SUPPORT
"use client";

import React, { useMemo, useRef, useState } from "react";
import { MoreVertical, Plus, Calendar, Sunrise, CalendarDays } from "lucide-react";
import {
  useArchiveProjectMutation,
  useDeleteProjectMutation,
  useProjects,
  useSaveProjectMutation,
  useUnarchiveProjectMutation,
} from "../../_hooks/useScheduleManagement";
import TreeMainComponent from "./TaskTreeComponents/TaskTreeMainComponent";
import { Project, ProjectFormData, SaveProjectInput, UpdateProjectInput, CreateProjectInput, ProjectStatus } from "../../types";
import Modal from "../Modal";
import ProjectForm from "../ProjectComponents/ProjectForm";

// Helper to get icon and title for due date view
const getDueDateViewInfo = (dueDateFilter: 'today' | 'tomorrow' | 'this-week') => {
  switch (dueDateFilter) {
    case 'today':
      return { icon: Calendar, label: 'Today', color: 'text-blue-600' };
    case 'tomorrow':
      return { icon: Sunrise, label: 'Tomorrow', color: 'text-orange-600' };
    case 'this-week':
      return { icon: CalendarDays, label: 'This Week', color: 'text-purple-600' };
  }
};

// Project Tabs Component
const ProjectTabs = ({
  projects,
  activeId,
  onSwitch,
  onProjectSettings,
  onAddProject,
  enableProjectManagement,
}: {
  projects: Project[];
  activeId: number | null;
  onSwitch: (projectId: number) => void;
  onProjectSettings: (projectId: number) => void;
  onAddProject: () => void;
  enableProjectManagement: boolean;
}) => (
  <div 
    data-layout="horizontal" 
    className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 w-full"
  >
    {/* Projects - each as nested layout */}
    <div className="flex overflow-x-auto scrollbar-hide w-0 flex-1">
      {projects.map((project, index) => (
        <div
          key={project.id}
          className={`flex items-center border-b-2 transition-all flex-shrink-0 ${
            activeId === project.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-transparent'
          }`}
          data-layout="horizontal"
          data-order={`${index + 1}`}
        >
          <button
            type="button"
            data-focusable
            data-order="1"
            onClick={() => onSwitch(project.id)}
            className={`relative flex items-center gap-2 px-4 py-3 transition-all duration-200 min-w-0 outline-none border-2 border-transparent focus-visible:border-blue-600 focus-visible:shadow-[inset_0_0_0_1px_rgb(37,99,235)] ${
              activeId === project.id
                ? 'text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <span className="font-medium whitespace-nowrap">{project.title}</span>
          </button>

          {enableProjectManagement && (
            <button
              type="button"
              data-focusable
              data-order="2"
              onClick={() => {
                onProjectSettings(project.id);
              }}
              className={`p-3 transition-all duration-200 flex-shrink-0 rounded-md m-1 outline-none border-2 border-transparent focus-visible:border-blue-600 focus-visible:shadow-lg ${
                activeId === project.id
                  ? 'text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/40'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label={`Project settings for ${project.title}`}
            >
              <MoreVertical className="size-4" />
            </button>
          )}
        </div>
      ))}
    </div>

    {/* Add Project Button - direct child of main layout */}
    {enableProjectManagement && (
      <button
        type="button"
        data-focusable
        data-order={`${projects.length + 1}`}
        onClick={onAddProject}
        className="relative flex items-center gap-2 px-4 py-3 border-l border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 flex-shrink-0 outline-none border-2 focus-visible:border-blue-600 focus-visible:shadow-[inset_0_0_0_1px_rgb(37,99,235)]"
        title="Add Project"
      >
        <Plus className="size-4" />
        <span className="font-medium">Add</span>
      </button>
    )}
  </div>
);

// Loading State Component
const LoadingState = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-3">
          <div className="size-4 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
          <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  );
};

// Main MyDay Tasks Component
interface MyDayTasksComponentProps {
  dueDateFilter?: 'today' | 'tomorrow' | 'this-week';
  chatId?: number; // ✅ NEW: Filter by chat when present
}

const MyDayTasksComponent: React.FC<MyDayTasksComponentProps> = ({ 
  dueDateFilter,
  chatId // ✅ NEW
}) => {
  console.log(`[MyDayTasksComponent] Rendering with dueDateFilter=${dueDateFilter}, chatId=${chatId}`);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  // Hooks - ✅ UPDATED: Pass chatId to filter projects
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ 
    status: 'active',
    chatId // ✅ NEW: When chatId is present, only get projects for that chat
  });
  const saveProjectMutation = useSaveProjectMutation();
  const deleteProjectMutation = useDeleteProjectMutation();
  const archiveProjectMutation = useArchiveProjectMutation();
  const unarchiveProjectMutation = useUnarchiveProjectMutation();

  const allProjects = useMemo(() => projectsData?.data || [], [projectsData?.data]);

  // Get the actual project ID to use (selected or default to first)
  const actualProjectId = selectedProjectId && allProjects.some(project => project.id === selectedProjectId)
    ? selectedProjectId
    : (allProjects.length > 0 ? allProjects[0].id : null);

  // Find the current project
  const currentProject = actualProjectId ? allProjects.find(p => p.id === actualProjectId) || null : null;

  const enableProjectManagement = !dueDateFilter && !chatId;

  const handleProjectChange = (projectId: number) => {
    setSelectedProjectId(projectId);
  };

  const handleProjectSettings = (projectId: number) => {
    if (!enableProjectManagement) return;

    modalTriggerRef.current = document.activeElement as HTMLElement;
    const project = allProjects.find((item) => item.id === projectId);
    if (!project) return;

    setSelectedProject(project);
    setShowProjectModal(true);
  };

  const handleAddProject = () => {
    if (!enableProjectManagement) return;

    modalTriggerRef.current = document.activeElement as HTMLElement;
    setSelectedProject(null);
    setShowProjectModal(true);
  };

  const handleProjectSave = async (submittedProjectData: ProjectFormData) => {
    if (!submittedProjectData.title?.trim()) {
      throw new Error('Project title is required');
    }

    let projectToSave: SaveProjectInput;
    if (selectedProject) {
      projectToSave = {
        id: selectedProject.id,
        title: submittedProjectData.title,
        type: submittedProjectData.type,
      } as UpdateProjectInput;
    } else {
      projectToSave = {
        title: submittedProjectData.title,
        type: submittedProjectData.type,
      } as CreateProjectInput;
    }

    const response = await saveProjectMutation.mutateAsync(projectToSave);
    if (!selectedProject && response.data?.id) {
      setSelectedProjectId(response.data.id);
    }
  };

  const handleProjectStatusChange = async (status: ProjectStatus) => {
    if (!selectedProject) return;

    await saveProjectMutation.mutateAsync({
      id: selectedProject.id,
      status,
    });

    if (status !== "active") {
      setSelectedProjectId(null);
    }
  };

  const handleProjectArchive = async () => {
    if (!selectedProject) return;

    await archiveProjectMutation.mutateAsync(selectedProject.id);
    setSelectedProjectId(null);
  };

  const handleProjectUnarchive = async () => {
    if (!selectedProject) return;

    await unarchiveProjectMutation.mutateAsync(selectedProject.id);
    setSelectedProjectId(selectedProject.id);
  };

  const handleProjectDelete = async () => {
    if (!selectedProject) return;

    await deleteProjectMutation.mutateAsync(selectedProject.id);
    setSelectedProjectId(null);
  };

  const isLifecycleLoading =
    archiveProjectMutation.isPending ||
    deleteProjectMutation.isPending ||
    unarchiveProjectMutation.isPending ||
    (saveProjectMutation.isPending && selectedProject !== null);

  const lifecycleError =
    archiveProjectMutation.error ||
    deleteProjectMutation.error ||
    unarchiveProjectMutation.error ||
    null;

  const restoreModalTriggerFocus = () => {
    const trigger = modalTriggerRef.current;
    modalTriggerRef.current = null;

    if (trigger && document.contains(trigger)) {
      requestAnimationFrame(() => trigger.focus());
    }
  };

  const handleProjectFormComplete = () => {
    setShowProjectModal(false);
    setSelectedProject(null);
    restoreModalTriggerFocus();
  };

  const handleModalClose = () => {
    setShowProjectModal(false);
    setSelectedProject(null);
    restoreModalTriggerFocus();
  };

  const getModalTitle = () => selectedProject ? "Edit Project" : "Create Project";

  return (
    <div className="w-full space-y-2">
      {/* Date Filter Header - only show when dueDateFilter is provided */}
      {dueDateFilter && (() => {
        const viewInfo = getDueDateViewInfo(dueDateFilter);
        const ViewIcon = viewInfo.icon;
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700 ${viewInfo.color}`}>
                <ViewIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {viewInfo.label}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tasks due for {viewInfo.label.toLowerCase()}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Project Tabs + Tree Section */}
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
        data-layout="vertical"
      >
        {/* Project Tabs - order 0 */}
        <div data-order="0">
          <ProjectTabs
            projects={allProjects}
            activeId={actualProjectId}
            onSwitch={handleProjectChange}
            onProjectSettings={handleProjectSettings}
            onAddProject={handleAddProject}
            enableProjectManagement={enableProjectManagement}
          />
        </div>

        {/* Tree content - order 1 */}
        <div data-order="1">
          {projectsLoading ? (
            <div className="p-6">
              <LoadingState />
            </div>
          ) : currentProject ? (
            <div className="w-full overflow-hidden">
              <TreeMainComponent 
                project={currentProject}
                dueDateFilter={dueDateFilter}
                chatId={chatId} // ✅ NEW: Pass chatId to tree
                key={`${currentProject.id}-${dueDateFilter || 'all'}-${chatId || 'none'}`} // ✅ UPDATED: Include chatId in key
              />
            </div>
          ) : allProjects.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {chatId 
                  ? 'No projects associated with this chat yet'
                  : 'No active projects available'
                }
              </p>
              {enableProjectManagement && (
                <button
                  type="button"
                  data-focusable
                  onClick={handleAddProject}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md active:scale-95 transition-all duration-200 outline-none focus-visible:ring-4 focus-visible:ring-blue-500/50"
                >
                  Create Your First Project
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-8 px-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No project selected
              </p>
            </div>
          )}
        </div>
      </div>

      {enableProjectManagement && (
        <Modal
          open={showProjectModal}
          onOpenChange={(open) => {
            if (!open) handleModalClose();
          }}
          title={getModalTitle()}
        >
          <ProjectForm
            key={selectedProject?.id || 'new'}
            selectedProject={selectedProject}
            onSave={handleProjectSave}
            onStatusChange={handleProjectStatusChange}
            onArchive={handleProjectArchive}
            onUnarchive={handleProjectUnarchive}
            onDelete={handleProjectDelete}
            onComplete={handleProjectFormComplete}
            closeModal={handleModalClose}
            isLoading={saveProjectMutation.isPending}
            isLifecycleLoading={isLifecycleLoading}
            error={saveProjectMutation.error}
            lifecycleError={lifecycleError}
          />
        </Modal>
      )}
    </div>
  );
};

export default MyDayTasksComponent;

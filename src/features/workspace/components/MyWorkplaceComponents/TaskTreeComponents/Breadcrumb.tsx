// Breadcrumb.tsx
import React, { useCallback } from 'react';
import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';

export interface BreadcrumbItem {
  id: string;
  title: string;
}

interface BreadcrumbProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (nodeId: string) => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  breadcrumbs, 
  onNavigate
}) => {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLButtonElement;
    
    // Only handle Space/Enter for breadcrumb navigation
    // NavigationService handles arrow keys automatically
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const breadcrumbId = target.getAttribute('data-breadcrumb-id');
      if (breadcrumbId) {
        onNavigate(breadcrumbId);
      }
      return;
    }
  }, [onNavigate]);

  if (!breadcrumbs || breadcrumbs.length <= 1) {
    return null;
  }

  const renderBreadcrumbs = () => {
    const maxItems = 4;

    if (breadcrumbs.length <= maxItems) {
      return breadcrumbs.map((crumb, index) => (
        <BreadcrumbItemComp
          key={crumb.id}
          crumb={crumb}
          isLast={index === breadcrumbs.length - 1}
          isFirst={index === 0}
          onNavigate={onNavigate}
          order={index}
        />
      ));
    }

    const result: React.ReactNode[] = [];
    let orderIndex = 0;

    // Home (project root)
    result.push(
      <BreadcrumbItemComp
        key={breadcrumbs[0].id}
        crumb={breadcrumbs[0]}
        isLast={false}
        isFirst={true}
        onNavigate={onNavigate}
        order={orderIndex++}
      />
    );

    // Ellipsis for hidden items (not focusable)
    if (breadcrumbs.length > 3) {
      result.push(
        <div key="ellipsis" className="flex items-center gap-2">
          <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <button
            className="px-2 py-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded transition-colors"
            title="Hidden breadcrumb levels"
            disabled
            tabIndex={-1}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      );
    }

    // Last two items
    const lastTwo = breadcrumbs.slice(-2);
    lastTwo.forEach((crumb, idx) => {
      const actualIndex = breadcrumbs.length - 2 + idx;
      
      result.push(
        <BreadcrumbItemComp
          key={crumb.id}
          crumb={crumb}
          isLast={actualIndex === breadcrumbs.length - 1}
          isFirst={false}
          onNavigate={onNavigate}
          order={orderIndex++}
        />
      );
    });

    return result;
  };

  return (
    <div
      className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      data-layout="horizontal"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="flex items-center gap-1 overflow-hidden">
        {renderBreadcrumbs()}
      </div>
    </div>
  );
};

const BreadcrumbItemComp: React.FC<{
  crumb: BreadcrumbItem;
  isLast: boolean;
  isFirst: boolean;
  onNavigate: (nodeId: string) => void;
  order: number;
}> = ({ crumb, isLast, isFirst, onNavigate, order }) => {
  const truncateText = (text: string, maxLength: number = 25) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  };

  const handleClick = useCallback(() => {
    onNavigate(crumb.id);
  }, [onNavigate, crumb.id]);

  return (
    <div className="flex items-center gap-1 min-w-0">
      {!isFirst && <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
      <button
        data-breadcrumb-id={crumb.id}
        data-focusable
        data-order={order}
        className={`px-2 py-1 rounded-md transition-all duration-200 min-w-0 flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-500 ${
          isLast
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium shadow-sm'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`}
        onClick={handleClick}
        title={crumb.title}
      >
        {isFirst ? (
          <Home className="w-4 h-4 flex-shrink-0" />
        ) : (
          <span className="truncate text-sm">
            {truncateText(crumb.title)}
          </span>
        )}
      </button>
    </div>
  );
};

BreadcrumbItemComp.displayName = 'BreadcrumbItemComp';
Breadcrumb.displayName = 'Breadcrumb';
export default Breadcrumb;
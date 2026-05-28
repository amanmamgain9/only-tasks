export type FocusableNode = {
  type: 'focusable';
  element: HTMLElement;
  parent: LayoutNode | null;
};

export type LayoutNode = {
  type: 'layout';
  element: HTMLElement;
  layout: 'vertical' | 'horizontal';
  wrap: boolean;
  children: FocusNode[];
  parent: LayoutNode | RegionNode | null;
  entrypointIndex: number | null;
};

export type RegionNode = {
  type: 'region';
  element: HTMLElement;
  wrap: boolean;
  children: LayoutNode[];
  parent: ScopeNode;
};

export type ScopeNode = {
  type: 'scope';
  element: HTMLElement;
  regions: RegionNode[];
};

export type FocusNode = FocusableNode | LayoutNode;
export type Node = ScopeNode | RegionNode | LayoutNode | FocusableNode;

export type SpatialDirection = 'up' | 'down' | 'left' | 'right';
export type SemanticDirection = 'forward' | 'backward';
export type Direction = SpatialDirection | SemanticDirection;

function parseLayoutOrder(order: string): number[] {
  return order.split('.').map(n => parseInt(n, 10));
}

export function compareLayoutOrder(a: string, b: string): number {
  const aParts = parseLayoutOrder(a);
  const bParts = parseLayoutOrder(b);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

function getLayoutAttribute(element: HTMLElement): string {
  return element.getAttribute('data-layout') || 'vertical';
}

function getWrapAttribute(element: HTMLElement): boolean {
  return element.hasAttribute('data-wrap');
}

function isFocusable(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.hasAttribute('data-layout')) return false;

  const hasFocusableAttr = element.hasAttribute('data-focusable');
  const matches = element.matches('button, textarea, input, select');
  if (!hasFocusableAttr && !matches) return false;

  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') return false;

  return true;
}

function isVisible(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    document.contains(element);
}

function getOrder(element: HTMLElement): string {
  return element.getAttribute('data-order') || '999';
}

function sortByOrder(nodes: FocusNode[] | RegionNode[] | LayoutNode[]) {
  nodes.sort((a, b) => compareLayoutOrder(getOrder(a.element), getOrder(b.element)));
}

function _findEntrypointIndex(children: FocusNode[]): number | null {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'focusable' && child.element.hasAttribute('data-entrypoint-focus')) {
      return i;
    }
  }
  return null;
}

function buildTree({ element, parent }: { element: HTMLElement; parent: Node | null }): Node | null {
  if (element.hasAttribute('data-scope')) {
    if (parent !== null) return null;
    const node: ScopeNode = { type: 'scope', element, regions: [] };
    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
    }
    sortByOrder(node.regions);
    return node.regions.length > 0 ? node : null;
  }

  if (element.hasAttribute('data-region')) {
    if (!isVisible(element)) return null;
    if (parent?.type !== 'scope') return null;
    const node: RegionNode = {
      type: 'region',
      element,
      wrap: getWrapAttribute(element),
      children: [],
      parent
    };
    parent.regions.push(node);
    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
    }
    sortByOrder(node.children);
    return node;
  }

  if (element.hasAttribute('data-layout')) {
    const node: LayoutNode = {
      type: 'layout',
      element,
      layout: getLayoutAttribute(element) as 'vertical' | 'horizontal',
      wrap: getWrapAttribute(element),
      children: [],
      parent: parent?.type === 'layout' || parent?.type === 'region' ? parent : null,
      entrypointIndex: null
    };

    if (parent?.type === 'layout') {
      parent.children.push(node);
    } else if (parent?.type === 'region') {
      parent.children.push(node);
    }

    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
    }

    sortByOrder(node.children);
    node.entrypointIndex = _findEntrypointIndex(node.children);

    return node;
  }

  if (isFocusable(element)) {
    if (parent?.type !== 'layout') return null;
    const node: FocusableNode = { type: 'focusable', element, parent };
    parent.children.push(node);
    for (const child of element.children) {
      if (child instanceof HTMLElement) buildTree({ element: child, parent });
    }
    return node;
  }

  for (const child of element.children) {
    if (child instanceof HTMLElement) buildTree({ element: child, parent });
  }
  return null;
}

function buildScopeTree(root: HTMLElement): ScopeNode | null {
  if (root.hasAttribute('data-scope')) {
    const result = buildTree({ element: root, parent: null });
    return result?.type === 'scope' ? result : null;
  }

  const node: ScopeNode = { type: 'scope', element: root, regions: [] };
  for (const child of root.children) {
    if (child instanceof HTMLElement) buildTree({ element: child, parent: node });
  }
  sortByOrder(node.regions);
  return node.regions.length > 0 ? node : null;
}

export const TraversalTreeService = {
  buildScopeTree,
  buildTree,
  isFocusable,
  parseLayoutOrder,
  compareLayoutOrder,
  getLayoutAttribute,

  semanticToSpatial({ semantic, layout }: { semantic: SemanticDirection; layout: 'vertical' | 'horizontal' }): SpatialDirection {
    if (layout === 'vertical') {
      return semantic === 'forward' ? 'down' : 'up';
    } else {
      return semantic === 'forward' ? 'right' : 'left';
    }
  },

  findFocusableNode({ tree, element }: { tree: ScopeNode; element: HTMLElement }): FocusableNode | null {
    const search = (node: ScopeNode | RegionNode | FocusNode): FocusableNode | null => {
      if (node.type === 'focusable' && node.element === element) {
        return node;
      }
      if (node.type === 'layout') {
        for (const child of node.children) {
          const found = search(child);
          if (found) return found;
        }
      }
      if (node.type === 'region') {
        for (const child of node.children) {
          const found = search(child);
          if (found) return found;
        }
      }
      if (node.type === 'scope') {
        for (const region of node.regions) {
          const found = search(region);
          if (found) return found;
        }
      }
      return null;
    };

    return search(tree);
  },

  findRegion(node: FocusNode): RegionNode | null {
    if (node.type === 'focusable') {
      return node.parent ? this.findRegion(node.parent) : null;
    }
    if (node.type === 'layout') {
      if (node.parent) {
        if (node.parent.type === 'region') return node.parent;
        return this.findRegion(node.parent);
      }
    }
    return null;
  },

  getLayoutFirstFocusable(layout: LayoutNode): HTMLElement | null {
    for (const child of layout.children) {
      if (child.type === 'focusable') return child.element;

      // If child layout has entrypoint, use it
      const entrypoint = this.getLayoutEntrypointFocusable(child);
      if (entrypoint) return entrypoint;

      // Otherwise recurse normally
      const focusable = this.getLayoutFirstFocusable(child);
      if (focusable) return focusable;
    }
    return null;
  },

  getLayoutLastFocusable(layout: LayoutNode): HTMLElement | null {
    for (let i = layout.children.length - 1; i >= 0; i--) {
      const child = layout.children[i];
      if (child.type === 'focusable') return child.element;

      // If child layout has entrypoint, use it
      const entrypoint = this.getLayoutEntrypointFocusable(child);
      if (entrypoint) return entrypoint;

      // Otherwise recurse normally
      const focusable = this.getLayoutLastFocusable(child);
      if (focusable) return focusable;
    }
    return null;
  },

  getLayoutEntrypointFocusable(layout: LayoutNode): HTMLElement | null {
    if (layout.entrypointIndex === null) return null;

    const entrypointChild = layout.children[layout.entrypointIndex];
    if (entrypointChild.type === 'focusable') {
      return entrypointChild.element;
    }
    return this.getLayoutEntrypointFocusable(entrypointChild);
  },

  getLayoutFocusable({ layout, direction }: { layout: LayoutNode; direction: 'first' | 'last' }): HTMLElement | null {
    // Always try entrypoint first
    const entrypoint = this.getLayoutEntrypointFocusable(layout);
    if (entrypoint) return entrypoint;

    // Fallback to directional
    return direction === 'first'
      ? this.getLayoutFirstFocusable(layout)
      : this.getLayoutLastFocusable(layout);
  },

  printTree(node: ScopeNode | RegionNode | FocusNode, indent = 0): void {
    const prefix = '  '.repeat(indent);
    if (node.type === 'scope') {
      console.log(`${prefix}SCOPE (${node.regions.length} regions)`);
      node.regions.forEach(region => this.printTree(region, indent + 1));
    } else if (node.type === 'region') {
      console.log(`${prefix}REGION: ${node.element.id || 'none'} wrap=${node.wrap}`);
      node.children.forEach(child => this.printTree(child, indent + 1));
    } else if (node.type === 'layout') {
      console.log(`${prefix}LAYOUT: ${node.layout} wrap=${node.wrap} entrypoint=${node.entrypointIndex} (${node.children.length} children)`);
      node.children.forEach(child => this.printTree(child, indent + 1));
    } else if (node.type === 'focusable') {
      console.log(`${prefix}FOCUSABLE: ${node.element.tagName} id=${node.element.id || 'none'}`);
    }
  },

  findNext({ currentNode, direction }: { currentNode: FocusableNode; direction: Direction }): HTMLElement | null {
    const isSemantic = (direction === 'forward' || direction === 'backward');
    const forward = (direction === 'forward' || direction === 'down' || direction === 'right');
    const parentLayout = currentNode.parent?.layout || 'vertical';
    const spatialDir = isSemantic
      ? this.semanticToSpatial({ semantic: direction as SemanticDirection, layout: parentLayout })
      : direction as SpatialDirection;

    const directionMatchesLayout = (layout: 'vertical' | 'horizontal', spatialDir: SpatialDirection): boolean => {
      return (layout === 'vertical' && (spatialDir === 'up' || spatialDir === 'down')) ||
        (layout === 'horizontal' && (spatialDir === 'left' || spatialDir === 'right'));
    };

    let current: FocusNode = currentNode;

    while (current.parent) {
      const parent: LayoutNode | RegionNode = current.parent;

      if (parent.type === 'region') {
        return null;
      }

      const layoutMatches = directionMatchesLayout(parent.layout, spatialDir);

      if (isSemantic || layoutMatches) {
        const childCount = parent.children.length;
        let index = -1;
        for (let childIndex = 0; childIndex < childCount; childIndex++) {
          if (parent.children[childIndex] === current) {
            index = childIndex;
            break;
          }
        }
        const nextIndex = forward ? index + 1 : index - 1;

        if (nextIndex >= 0 && nextIndex < childCount) {
          const sibling = parent.children[nextIndex];
          if (sibling.type === 'focusable') {
            return sibling.element;
          }
          const focusable = this.getLayoutFocusable({
            layout: sibling,
            direction: forward ? 'first' : 'last'
          });
          if (focusable) {
            return focusable;
          }
          // Continue searching if sibling has no focusables
        }

        if (parent.wrap) {
          const wrapIndex = forward ? 0 : childCount - 1;
          const wrapped = parent.children[wrapIndex];
          if (wrapped.type === 'focusable') {
            return wrapped.element;
          }
          return this.getLayoutFocusable({
            layout: wrapped,
            direction: forward ? 'first' : 'last'
          });
        }
      }

      current = parent;
    }

    return null;
  },

  findFirstInLayout(layout: LayoutNode): HTMLElement | null {
    return this.getLayoutFocusable({ layout, direction: 'first' });
  },
};

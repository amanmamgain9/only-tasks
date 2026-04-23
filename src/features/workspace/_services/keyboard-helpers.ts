// keyboard-helpers.ts

export function shouldElementConsumeKey(element: HTMLElement, direction: 'up' | 'down' | 'left' | 'right'): boolean {
  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type') || 'text';

  if (tagName === 'input' && type === 'number' && (direction === 'up' || direction === 'down')) return true;
  if (tagName === 'input' && ['text', 'email', 'password', 'search', 'tel', 'url'].includes(type)) {
    if (direction === 'left' || direction === 'right') return true;
  }

  if (tagName === 'textarea') {
    const textarea = element as HTMLTextAreaElement;
    const { selectionStart, selectionEnd, value } = textarea;

    if (selectionStart !== selectionEnd) return true;

    const atStart = selectionStart === 0;
    const atEnd = selectionStart === value.length;

    if (!value.includes('\n')) {
      if (direction === 'left') return !atStart;
      if (direction === 'right') return !atEnd;
      return false;
    }

    const beforeCursor = value.substring(0, selectionStart);
    const afterCursor = value.substring(selectionStart);

    const firstLine = !beforeCursor.includes('\n');
    const lastLine = !afterCursor.includes('\n');

    if (direction === 'up' && !firstLine) return true;
    if (direction === 'down' && !lastLine) return true;
    if (direction === 'left' && !atStart) return true;
    if (direction === 'right' && !atEnd) return true;

    return false;
  }

  if (tagName === 'select' && (direction === 'up' || direction === 'down')) return true;
  if (tagName === 'input' && ['date', 'time', 'datetime-local', 'month', 'week'].includes(type)) return true;

  return false;
}

export function isConsumingElement(element: HTMLElement): boolean {
  // Check for data-tab-consume attribute first
  if (element.hasAttribute('data-tab-consume')) return true;

  const tagName = element.tagName.toLowerCase();
  const type = element.getAttribute('type') || 'text';

  if (tagName === 'input') return true;
  if (tagName === 'textarea') return true;
  if (tagName === 'select') return true;

  return false;
}
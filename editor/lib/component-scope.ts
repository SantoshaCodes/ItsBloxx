/**
 * component-scope.ts — Component scope system for static vs editable components
 *
 * - `static` components: Changes propagate to ALL pages using this component
 * - `editable` components: Changes only affect the current page instance
 */

export type ComponentScope = 'static' | 'editable';

/**
 * Component definition with scope
 */
export interface ScopedComponent {
  id: number;
  shortId: string;
  name: string;
  type: string;
  scope: ComponentScope;
  html: string;
  variables: ComponentVariable[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Component variable definition
 */
export interface ComponentVariable {
  id: string;
  type: 'text' | 'textarea' | 'image' | 'url' | 'email' | 'phone' | 'color' | 'select' | 'number' | 'boolean' | 'action_config';
  label: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // For select type
  lazyLoad?: boolean; // For image type
}

/**
 * Page-component junction with override values
 */
export interface PageComponent {
  id: number;
  pageId: number;
  componentId: number;
  order: number;
  overrideValues: Record<string, any> | null; // Only for editable components
  component: ScopedComponent;
}

/**
 * Check if a component is global (static scope)
 */
export function isGlobalComponent(component: ScopedComponent): boolean {
  return component.scope === 'static';
}

/**
 * Check if a component instance can be edited locally
 */
export function canEditLocally(pageComponent: PageComponent): boolean {
  return pageComponent.component.scope === 'editable';
}

/**
 * Get effective variable values for a component instance
 * For editable: merge defaults with overrides
 * For static: always use the component's current values
 */
export function getEffectiveValues(
  component: ScopedComponent,
  overrideValues: Record<string, any> | null
): Record<string, any> {
  const defaults: Record<string, any> = {};

  // Build defaults from component variables
  for (const variable of component.variables) {
    if (variable.defaultValue !== undefined) {
      defaults[variable.id] = variable.defaultValue;
    }
  }

  // For static components, only use defaults (no overrides)
  if (component.scope === 'static') {
    return defaults;
  }

  // For editable components, merge with overrides
  return {
    ...defaults,
    ...overrideValues,
  };
}

/**
 * Determine if editing this component should warn about global impact
 */
export function shouldWarnGlobalEdit(component: ScopedComponent): boolean {
  return component.scope === 'static';
}

/**
 * Get scope badge configuration for UI
 */
export function getScopeBadge(scope: ComponentScope): { label: string; color: string; icon: string } {
  if (scope === 'static') {
    return {
      label: 'Global',
      color: '#f59e0b', // amber
      icon: 'globe',
    };
  }
  return {
    label: 'Page',
    color: '#6366f1', // indigo
    icon: 'file-earmark',
  };
}

/**
 * Get warning message for global component editing
 */
export function getGlobalEditWarning(componentName: string): string {
  return `"${componentName}" is a global component. Changes will affect ALL pages using this component.`;
}

/**
 * Validate scope change (static -> editable requires confirmation)
 */
export function validateScopeChange(
  currentScope: ComponentScope,
  newScope: ComponentScope,
  usageCount: number
): { allowed: boolean; warning?: string } {
  // Changing from editable to static is always allowed
  if (currentScope === 'editable' && newScope === 'static') {
    return { allowed: true };
  }

  // Changing from static to editable when used on multiple pages needs confirmation
  if (currentScope === 'static' && newScope === 'editable' && usageCount > 1) {
    return {
      allowed: true,
      warning: `This component is used on ${usageCount} pages. Changing to "editable" will create separate instances on each page with current values.`,
    };
  }

  return { allowed: true };
}

/**
 * Component categories with default scopes
 */
export const COMPONENT_CATEGORY_DEFAULTS: Record<string, ComponentScope> = {
  // Headers and footers are typically global
  'header': 'static',
  'footer': 'static',
  'navigation': 'static',

  // Content sections are typically page-specific
  'hero': 'editable',
  'features': 'editable',
  'testimonials': 'editable',
  'pricing': 'editable',
  'cta': 'editable',
  'faq': 'editable',
  'gallery': 'editable',
  'team': 'editable',
  'contact': 'editable',
  'blog': 'editable',

  // Forms can be either, default to editable
  'form': 'editable',
  'action': 'editable',
};

/**
 * Get default scope for a component category
 */
export function getDefaultScope(category: string): ComponentScope {
  return COMPONENT_CATEGORY_DEFAULTS[category.toLowerCase()] || 'editable';
}

/**
 * Create a new page component instance
 */
export function createPageComponent(
  pageId: number,
  component: ScopedComponent,
  order: number,
  initialValues?: Record<string, any>
): Omit<PageComponent, 'id'> {
  return {
    pageId,
    componentId: component.id,
    order,
    overrideValues: component.scope === 'editable' ? (initialValues || null) : null,
    component,
  };
}

/**
 * Clone a component for duplication (handles scope correctly)
 */
export function cloneComponentForPage(
  pageComponent: PageComponent,
  newPageId: number,
  newOrder: number
): Omit<PageComponent, 'id'> {
  if (pageComponent.component.scope === 'static') {
    // For static components, just reference the same component
    return {
      pageId: newPageId,
      componentId: pageComponent.componentId,
      order: newOrder,
      overrideValues: null,
      component: pageComponent.component,
    };
  }

  // For editable components, copy the override values
  return {
    pageId: newPageId,
    componentId: pageComponent.componentId,
    order: newOrder,
    overrideValues: pageComponent.overrideValues ? { ...pageComponent.overrideValues } : null,
    component: pageComponent.component,
  };
}

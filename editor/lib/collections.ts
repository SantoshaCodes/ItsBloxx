/**
 * collections.ts — Dynamic CMS / Collection system
 *
 * Collections are groups of similar items (blog posts, products, team members)
 * with defined schemas that can be used in templates with {{collection.fieldName}} syntax.
 */

export type CollectionFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'image'
  | 'file'
  | 'url'
  | 'email'
  | 'select'
  | 'multiselect'
  | 'reference'
  | 'json';

export type ItemStatus = 'draft' | 'published' | 'archived';

/**
 * Collection field definition
 */
export interface CollectionField {
  id: string;
  type: CollectionFieldType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;

  // Type-specific options
  options?: string[]; // For select/multiselect
  referenceCollection?: string; // For reference type
  minLength?: number; // For text/textarea
  maxLength?: number; // For text/textarea
  min?: number; // For number
  max?: number; // For number
  accept?: string; // For file/image (e.g., '.pdf,.doc')

  // Special flags
  isSlugSource?: boolean; // This field generates the URL slug
  isTitle?: boolean; // This field is the display title
  showInList?: boolean; // Show in collection list view
  searchable?: boolean; // Include in search
}

/**
 * Collection schema
 */
export interface CollectionSchema {
  fields: CollectionField[];
}

/**
 * Collection definition
 */
export interface Collection {
  id: number;
  siteId: number;
  name: string;
  slug: string;
  description?: string;
  schema: CollectionSchema;
  templatePageId?: number; // Reference to page template
  itemsPerPage?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  createdAt: string;
  updatedAt: string;
}

/**
 * Collection item
 */
export interface CollectionItem {
  id: number;
  collectionId: number;
  slug: string;
  data: Record<string, any>;
  status: ItemStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Preset collection templates for common use cases
 */
export const COLLECTION_PRESETS: Record<string, CollectionSchema> = {
  'blog-posts': {
    fields: [
      { id: 'title', type: 'text', label: 'Post Title', required: true, isSlugSource: true, isTitle: true, showInList: true, searchable: true },
      { id: 'excerpt', type: 'textarea', label: 'Excerpt', maxLength: 200, showInList: true, searchable: true },
      { id: 'featuredImage', type: 'image', label: 'Featured Image', required: true, showInList: true },
      { id: 'content', type: 'richtext', label: 'Content', required: true, searchable: true },
      { id: 'author', type: 'reference', label: 'Author', referenceCollection: 'team' },
      { id: 'category', type: 'select', label: 'Category', options: ['Tech', 'Business', 'Design', 'Marketing', 'News'], showInList: true },
      { id: 'tags', type: 'multiselect', label: 'Tags', options: [] },
      { id: 'publishDate', type: 'date', label: 'Publish Date', showInList: true },
      { id: 'readingTime', type: 'number', label: 'Reading Time (min)' },
    ],
  },

  'products': {
    fields: [
      { id: 'name', type: 'text', label: 'Product Name', required: true, isSlugSource: true, isTitle: true, showInList: true, searchable: true },
      { id: 'description', type: 'richtext', label: 'Description', required: true, searchable: true },
      { id: 'shortDescription', type: 'textarea', label: 'Short Description', maxLength: 160 },
      { id: 'images', type: 'image', label: 'Product Images', showInList: true },
      { id: 'price', type: 'number', label: 'Price', required: true, min: 0, showInList: true },
      { id: 'salePrice', type: 'number', label: 'Sale Price', min: 0 },
      { id: 'sku', type: 'text', label: 'SKU', showInList: true },
      { id: 'category', type: 'reference', label: 'Category', referenceCollection: 'product-categories' },
      { id: 'inStock', type: 'boolean', label: 'In Stock', defaultValue: true, showInList: true },
      { id: 'featured', type: 'boolean', label: 'Featured Product', defaultValue: false },
    ],
  },

  'team': {
    fields: [
      { id: 'name', type: 'text', label: 'Full Name', required: true, isSlugSource: true, isTitle: true, showInList: true, searchable: true },
      { id: 'role', type: 'text', label: 'Job Title', required: true, showInList: true },
      { id: 'photo', type: 'image', label: 'Photo', required: true, showInList: true },
      { id: 'bio', type: 'richtext', label: 'Bio', searchable: true },
      { id: 'email', type: 'email', label: 'Email' },
      { id: 'phone', type: 'text', label: 'Phone' },
      { id: 'linkedin', type: 'url', label: 'LinkedIn URL' },
      { id: 'twitter', type: 'url', label: 'Twitter URL' },
      { id: 'department', type: 'select', label: 'Department', options: ['Leadership', 'Engineering', 'Design', 'Marketing', 'Sales', 'Support'] },
      { id: 'order', type: 'number', label: 'Display Order', defaultValue: 0 },
    ],
  },

  'testimonials': {
    fields: [
      { id: 'quote', type: 'textarea', label: 'Quote', required: true, isTitle: true, showInList: true, searchable: true },
      { id: 'author', type: 'text', label: 'Author Name', required: true, showInList: true },
      { id: 'role', type: 'text', label: 'Author Role/Title' },
      { id: 'company', type: 'text', label: 'Company' },
      { id: 'avatar', type: 'image', label: 'Avatar', showInList: true },
      { id: 'rating', type: 'number', label: 'Rating', min: 1, max: 5 },
      { id: 'featured', type: 'boolean', label: 'Featured', defaultValue: false, showInList: true },
    ],
  },

  'services': {
    fields: [
      { id: 'name', type: 'text', label: 'Service Name', required: true, isSlugSource: true, isTitle: true, showInList: true, searchable: true },
      { id: 'description', type: 'richtext', label: 'Description', required: true, searchable: true },
      { id: 'shortDescription', type: 'textarea', label: 'Short Description', maxLength: 160 },
      { id: 'icon', type: 'text', label: 'Icon Name (Bootstrap Icons)' },
      { id: 'image', type: 'image', label: 'Service Image', showInList: true },
      { id: 'price', type: 'text', label: 'Starting Price' },
      { id: 'features', type: 'json', label: 'Features (JSON array)' },
      { id: 'order', type: 'number', label: 'Display Order', defaultValue: 0 },
    ],
  },

  'faqs': {
    fields: [
      { id: 'question', type: 'text', label: 'Question', required: true, isTitle: true, showInList: true, searchable: true },
      { id: 'answer', type: 'richtext', label: 'Answer', required: true, searchable: true },
      { id: 'category', type: 'select', label: 'Category', options: ['General', 'Pricing', 'Support', 'Features'], showInList: true },
      { id: 'order', type: 'number', label: 'Display Order', defaultValue: 0 },
    ],
  },

  'events': {
    fields: [
      { id: 'title', type: 'text', label: 'Event Title', required: true, isSlugSource: true, isTitle: true, showInList: true, searchable: true },
      { id: 'description', type: 'richtext', label: 'Description', required: true, searchable: true },
      { id: 'image', type: 'image', label: 'Event Image', showInList: true },
      { id: 'startDate', type: 'datetime', label: 'Start Date/Time', required: true, showInList: true },
      { id: 'endDate', type: 'datetime', label: 'End Date/Time' },
      { id: 'location', type: 'text', label: 'Location', showInList: true },
      { id: 'isOnline', type: 'boolean', label: 'Online Event', defaultValue: false },
      { id: 'registrationUrl', type: 'url', label: 'Registration URL' },
      { id: 'price', type: 'text', label: 'Ticket Price' },
    ],
  },

  'portfolio': {
    fields: [
      { id: 'title', type: 'text', label: 'Project Title', required: true, isSlugSource: true, isTitle: true, showInList: true, searchable: true },
      { id: 'description', type: 'richtext', label: 'Description', searchable: true },
      { id: 'thumbnail', type: 'image', label: 'Thumbnail', required: true, showInList: true },
      { id: 'images', type: 'image', label: 'Gallery Images' },
      { id: 'client', type: 'text', label: 'Client Name' },
      { id: 'category', type: 'select', label: 'Category', options: ['Web Design', 'Branding', 'Development', 'Marketing'], showInList: true },
      { id: 'url', type: 'url', label: 'Project URL' },
      { id: 'completedDate', type: 'date', label: 'Completed Date' },
      { id: 'featured', type: 'boolean', label: 'Featured', defaultValue: false },
    ],
  },
};

/**
 * Generate URL slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

/**
 * Get the title field from a collection schema
 */
export function getTitleField(schema: CollectionSchema): CollectionField | undefined {
  return schema.fields.find(f => f.isTitle);
}

/**
 * Get the slug source field from a collection schema
 */
export function getSlugSourceField(schema: CollectionSchema): CollectionField | undefined {
  return schema.fields.find(f => f.isSlugSource);
}

/**
 * Get fields to show in list view
 */
export function getListFields(schema: CollectionSchema): CollectionField[] {
  return schema.fields.filter(f => f.showInList);
}

/**
 * Get searchable fields
 */
export function getSearchableFields(schema: CollectionSchema): CollectionField[] {
  return schema.fields.filter(f => f.searchable);
}

/**
 * Validate collection item data against schema
 */
export function validateItemData(
  data: Record<string, any>,
  schema: CollectionSchema
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of schema.fields) {
    const value = data[field.id];

    // Required validation
    if (field.required && (value === undefined || value === null || value === '')) {
      errors[field.id] = `${field.label} is required`;
      continue;
    }

    // Skip further validation if empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Type-specific validation
    switch (field.type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors[field.id] = 'Invalid email address';
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          errors[field.id] = 'Invalid URL';
        }
        break;

      case 'number':
        const num = parseFloat(value);
        if (isNaN(num)) {
          errors[field.id] = 'Must be a number';
        } else {
          if (field.min !== undefined && num < field.min) {
            errors[field.id] = `Must be at least ${field.min}`;
          }
          if (field.max !== undefined && num > field.max) {
            errors[field.id] = `Must be no more than ${field.max}`;
          }
        }
        break;

      case 'text':
      case 'textarea':
        if (field.minLength && value.length < field.minLength) {
          errors[field.id] = `Must be at least ${field.minLength} characters`;
        }
        if (field.maxLength && value.length > field.maxLength) {
          errors[field.id] = `Must be no more than ${field.maxLength} characters`;
        }
        break;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Get item title/display name from data
 */
export function getItemTitle(item: CollectionItem, schema: CollectionSchema): string {
  const titleField = getTitleField(schema);
  if (titleField && item.data[titleField.id]) {
    const value = item.data[titleField.id];
    // Truncate if too long
    return typeof value === 'string' && value.length > 60
      ? value.substring(0, 60) + '...'
      : String(value);
  }
  return `Item #${item.id}`;
}

/**
 * Replace collection template variables in HTML
 * Supports {{collection.fieldName}} syntax
 */
export function replaceCollectionVariables(
  template: string,
  item: CollectionItem,
  collection: Collection
): string {
  return template.replace(/\{\{collection\.([^}]+)\}\}/g, (match, fieldPath) => {
    const parts = fieldPath.trim().split('.');
    let value: any = item.data;

    for (const part of parts) {
      if (value === undefined || value === null) return '';
      value = value[part];
    }

    if (value === undefined || value === null) return '';

    // Special handling for rich text (don't escape HTML)
    const field = collection.schema.fields.find(f => f.id === parts[0]);
    if (field?.type === 'richtext') {
      return String(value);
    }

    // Escape HTML for other fields
    return escapeHtml(String(value));
  });
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generate collection item URL
 */
export function getItemUrl(item: CollectionItem, collection: Collection): string {
  return `/${collection.slug}/${item.slug}/`;
}

/**
 * Generate collection list URL
 */
export function getCollectionUrl(collection: Collection): string {
  return `/${collection.slug}/`;
}

/**
 * Filter and sort collection items
 */
export function filterItems(
  items: CollectionItem[],
  options: {
    status?: ItemStatus | ItemStatus[];
    search?: string;
    filters?: Record<string, any>;
    sortField?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  },
  schema: CollectionSchema
): CollectionItem[] {
  let filtered = [...items];

  // Filter by status
  if (options.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    filtered = filtered.filter(item => statuses.includes(item.status));
  }

  // Search
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    const searchableFields = getSearchableFields(schema);
    filtered = filtered.filter(item =>
      searchableFields.some(field => {
        const value = item.data[field.id];
        return value && String(value).toLowerCase().includes(searchLower);
      })
    );
  }

  // Custom filters
  if (options.filters) {
    for (const [fieldId, filterValue] of Object.entries(options.filters)) {
      if (filterValue !== undefined && filterValue !== null && filterValue !== '') {
        filtered = filtered.filter(item => {
          const value = item.data[fieldId];
          if (Array.isArray(filterValue)) {
            return filterValue.includes(value);
          }
          return value === filterValue;
        });
      }
    }
  }

  // Sort
  const sortField = options.sortField || 'createdAt';
  const sortOrder = options.sortOrder || 'desc';
  filtered.sort((a, b) => {
    let aVal = sortField === 'createdAt' || sortField === 'updatedAt' || sortField === 'publishedAt'
      ? a[sortField as keyof CollectionItem]
      : a.data[sortField];
    let bVal = sortField === 'createdAt' || sortField === 'updatedAt' || sortField === 'publishedAt'
      ? b[sortField as keyof CollectionItem]
      : b.data[sortField];

    if (aVal === undefined) aVal = '';
    if (bVal === undefined) bVal = '';

    const comparison = String(aVal).localeCompare(String(bVal));
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Pagination
  if (options.offset !== undefined) {
    filtered = filtered.slice(options.offset);
  }
  if (options.limit !== undefined) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

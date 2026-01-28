/**
 * action-components.ts — Action component system for forms and interactive elements
 *
 * Action components have defined behavior for form submissions,
 * including email, webhook, database, and third-party integrations.
 */

export type ActionType = 'email' | 'webhook' | 'database' | 'zapier';
export type ResponseType = 'message' | 'redirect' | 'callback';
export type ValidationRuleType = 'required' | 'email' | 'phone' | 'url' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max';

/**
 * Action component type definition
 */
export const ACTION_COMPONENT_TYPE = {
  id: 'action',
  name: 'Action',
  description: 'Interactive components with defined behavior',
  icon: 'lightning-charge',
  examples: ['Contact Form', 'Newsletter Signup', 'Lead Capture', 'Booking Request', 'Quote Request'],
  color: 'rose',
};

/**
 * Email action configuration
 */
export interface EmailActionConfig {
  to: string; // Can use {{global.businessEmail}} syntax
  cc?: string;
  bcc?: string;
  subject: string; // Can use {{formType}} or field references
  replyTo?: string; // Can use {{submitterEmail}} to reference form field
  template?: string; // Optional email template ID
}

/**
 * Webhook action configuration
 */
export interface WebhookActionConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  includeFields: '*' | string[]; // '*' means all fields
  transformPayload?: string; // Optional JSON template
}

/**
 * Database action configuration
 */
export interface DatabaseActionConfig {
  table: string;
  mappings: Record<string, string>; // column: {{fieldName}} syntax
  onDuplicate?: 'ignore' | 'update' | 'error';
}

/**
 * Zapier/third-party action configuration
 */
export interface ZapierActionConfig {
  webhookUrl: string;
  includeFields: '*' | string[];
}

/**
 * Success response configuration
 */
export interface SuccessResponseConfig {
  type: ResponseType;
  message?: string;
  redirectUrl?: string;
  callbackFunction?: string; // For custom JS callback
  showConfetti?: boolean;
}

/**
 * Error response configuration
 */
export interface ErrorResponseConfig {
  type: 'message' | 'retry';
  message?: string;
  maxRetries?: number;
}

/**
 * Field validation rule
 */
export interface ValidationRule {
  type: ValidationRuleType;
  value?: string | number | boolean;
  message?: string; // Custom error message
}

/**
 * Form field validation configuration
 */
export interface FieldValidation {
  [fieldName: string]: ValidationRule[];
}

/**
 * Complete action configuration
 */
export interface ActionConfig {
  action: ActionType;
  emailConfig?: EmailActionConfig;
  webhookConfig?: WebhookActionConfig;
  databaseConfig?: DatabaseActionConfig;
  zapierConfig?: ZapierActionConfig;
  onSuccess: SuccessResponseConfig;
  onError: ErrorResponseConfig;
  validation: FieldValidation;
  rateLimit?: {
    maxSubmissions: number;
    windowMinutes: number;
  };
  honeypot?: {
    enabled: boolean;
    fieldName?: string;
  };
  recaptcha?: {
    enabled: boolean;
    siteKey?: string;
    threshold?: number; // 0.0 - 1.0 for v3
  };
}

/**
 * Default action configurations for common form types
 */
export const DEFAULT_ACTION_CONFIGS: Record<string, Partial<ActionConfig>> = {
  'contact-form': {
    action: 'email',
    emailConfig: {
      to: '{{global.business.email}}',
      subject: 'New Contact Form Submission',
      replyTo: '{{email}}',
    },
    onSuccess: {
      type: 'message',
      message: "Thanks for reaching out! We'll get back to you within 24 hours.",
    },
    onError: {
      type: 'message',
      message: 'Something went wrong. Please try again or contact us directly.',
    },
    validation: {
      name: [{ type: 'required', message: 'Please enter your name' }, { type: 'minLength', value: 2 }],
      email: [{ type: 'required' }, { type: 'email', message: 'Please enter a valid email' }],
      message: [{ type: 'required', message: 'Please enter a message' }],
    },
  },

  'newsletter-signup': {
    action: 'webhook',
    webhookConfig: {
      url: '', // Set by user
      method: 'POST',
      includeFields: ['email', 'firstName'],
    },
    onSuccess: {
      type: 'message',
      message: "You're subscribed! Check your email to confirm.",
    },
    onError: {
      type: 'message',
      message: 'Could not subscribe. Please try again.',
    },
    validation: {
      email: [{ type: 'required' }, { type: 'email' }],
    },
  },

  'lead-capture': {
    action: 'database',
    databaseConfig: {
      table: 'leads',
      mappings: {
        name: '{{name}}',
        email: '{{email}}',
        phone: '{{phone}}',
        company: '{{company}}',
        source: '{{pageUrl}}',
      },
    },
    onSuccess: {
      type: 'message',
      message: "Thanks! We'll be in touch shortly.",
    },
    onError: {
      type: 'message',
      message: 'Something went wrong. Please try again.',
    },
    validation: {
      email: [{ type: 'required' }, { type: 'email' }],
      phone: [{ type: 'phone' }],
    },
  },

  'booking-request': {
    action: 'email',
    emailConfig: {
      to: '{{global.business.email}}',
      subject: 'New Booking Request - {{service}}',
      replyTo: '{{email}}',
    },
    onSuccess: {
      type: 'message',
      message: "Booking request received! We'll confirm your appointment within 24 hours.",
    },
    onError: {
      type: 'message',
      message: 'Could not process your booking. Please call us directly.',
    },
    validation: {
      name: [{ type: 'required' }],
      email: [{ type: 'required' }, { type: 'email' }],
      phone: [{ type: 'required' }, { type: 'phone' }],
      date: [{ type: 'required' }],
      service: [{ type: 'required' }],
    },
  },

  'quote-request': {
    action: 'database',
    databaseConfig: {
      table: 'quote_requests',
      mappings: {
        name: '{{name}}',
        email: '{{email}}',
        phone: '{{phone}}',
        service: '{{service}}',
        details: '{{details}}',
        budget: '{{budget}}',
      },
    },
    onSuccess: {
      type: 'redirect',
      redirectUrl: '/thank-you',
    },
    onError: {
      type: 'message',
      message: 'Could not submit your request. Please try again.',
    },
    validation: {
      name: [{ type: 'required' }],
      email: [{ type: 'required' }, { type: 'email' }],
      service: [{ type: 'required' }],
    },
  },
};

/**
 * Validate a single field value against rules
 */
export function validateField(value: any, rules: ValidationRule[]): string | null {
  for (const rule of rules) {
    const error = applyValidationRule(value, rule);
    if (error) return error;
  }
  return null;
}

/**
 * Apply a single validation rule
 */
function applyValidationRule(value: any, rule: ValidationRule): string | null {
  const stringValue = String(value || '').trim();

  switch (rule.type) {
    case 'required':
      if (!stringValue) {
        return rule.message || 'This field is required';
      }
      break;

    case 'email':
      if (stringValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
        return rule.message || 'Please enter a valid email address';
      }
      break;

    case 'phone':
      if (stringValue && !/^[0-9\-+().\s]+$/.test(stringValue)) {
        return rule.message || 'Please enter a valid phone number';
      }
      break;

    case 'url':
      if (stringValue) {
        try {
          new URL(stringValue);
        } catch {
          return rule.message || 'Please enter a valid URL';
        }
      }
      break;

    case 'minLength':
      if (stringValue && stringValue.length < (rule.value as number)) {
        return rule.message || `Must be at least ${rule.value} characters`;
      }
      break;

    case 'maxLength':
      if (stringValue && stringValue.length > (rule.value as number)) {
        return rule.message || `Must be no more than ${rule.value} characters`;
      }
      break;

    case 'pattern':
      if (stringValue && !new RegExp(rule.value as string).test(stringValue)) {
        return rule.message || 'Invalid format';
      }
      break;

    case 'min':
      const numValue = parseFloat(stringValue);
      if (!isNaN(numValue) && numValue < (rule.value as number)) {
        return rule.message || `Must be at least ${rule.value}`;
      }
      break;

    case 'max':
      const maxValue = parseFloat(stringValue);
      if (!isNaN(maxValue) && maxValue > (rule.value as number)) {
        return rule.message || `Must be no more than ${rule.value}`;
      }
      break;
  }

  return null;
}

/**
 * Validate all form fields
 */
export function validateForm(
  data: Record<string, any>,
  validation: FieldValidation
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [fieldName, rules] of Object.entries(validation)) {
    const error = validateField(data[fieldName], rules);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return errors;
}

/**
 * Replace template variables in a string
 * Supports {{fieldName}} and {{global.path.to.value}} syntax
 */
export function replaceTemplateVariables(
  template: string,
  formData: Record<string, any>,
  globalSettings?: Record<string, any>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const trimmedPath = path.trim();

    // Check for global variables
    if (trimmedPath.startsWith('global.')) {
      const globalPath = trimmedPath.substring(7).split('.');
      let value = globalSettings;
      for (const key of globalPath) {
        value = value?.[key];
        if (value === undefined) break;
      }
      return value !== undefined ? String(value) : match;
    }

    // Check form data
    if (formData[trimmedPath] !== undefined) {
      return String(formData[trimmedPath]);
    }

    return match; // Keep original if not found
  });
}

/**
 * Build email body from form data
 */
export function buildEmailBody(formData: Record<string, any>, formName?: string): string {
  const lines: string[] = [];

  if (formName) {
    lines.push(`Form: ${formName}`);
    lines.push('---');
  }

  for (const [key, value] of Object.entries(formData)) {
    // Skip internal fields
    if (key.startsWith('_')) continue;

    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    lines.push(`${label}: ${value}`);
  }

  lines.push('');
  lines.push(`Submitted: ${new Date().toISOString()}`);

  return lines.join('\n');
}

/**
 * Get action type label for UI
 */
export function getActionTypeLabel(actionType: ActionType): string {
  const labels: Record<ActionType, string> = {
    email: 'Send Email',
    webhook: 'Send to Webhook',
    database: 'Save to Database',
    zapier: 'Send to Zapier',
  };
  return labels[actionType];
}

/**
 * Get action type icon for UI
 */
export function getActionTypeIcon(actionType: ActionType): string {
  const icons: Record<ActionType, string> = {
    email: 'envelope',
    webhook: 'link-45deg',
    database: 'database',
    zapier: 'lightning',
  };
  return icons[actionType];
}

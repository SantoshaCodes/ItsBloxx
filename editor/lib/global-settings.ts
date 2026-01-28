/**
 * global-settings.ts — Global site settings schema and utilities
 *
 * Defines the structure for site-wide configuration including
 * business info, analytics, SEO defaults, and branding.
 */

export type SettingFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'textarea'
  | 'number'
  | 'color'
  | 'select'
  | 'image'
  | 'code'
  | 'boolean'
  | 'object'
  | 'array';

/**
 * Setting field definition
 */
export interface SettingField {
  type: SettingFieldType;
  label: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // For select type
  accept?: string; // For image type (e.g., '.ico,.png,.svg')
  language?: string; // For code type (e.g., 'html', 'css', 'javascript')
  fields?: Record<string, SettingField>; // For object type
  itemType?: SettingFieldType; // For array type
  itemFields?: Record<string, SettingField>; // For array of objects
  defaultValue?: any;
}

/**
 * Settings category with fields
 */
export interface SettingsCategory {
  label: string;
  description?: string;
  icon: string;
  fields: Record<string, SettingField>;
}

/**
 * Global settings schema
 */
export const GLOBAL_SETTINGS_SCHEMA: Record<string, SettingsCategory> = {
  business: {
    label: 'Business Information',
    description: 'Core business details used across your site',
    icon: 'building',
    fields: {
      name: {
        type: 'text',
        label: 'Business Name',
        required: true,
        placeholder: 'Your Business Name',
      },
      tagline: {
        type: 'text',
        label: 'Tagline',
        placeholder: 'A short memorable phrase',
      },
      email: {
        type: 'email',
        label: 'Contact Email',
        required: true,
        placeholder: 'hello@example.com',
      },
      phone: {
        type: 'tel',
        label: 'Phone Number',
        placeholder: '+1 (555) 123-4567',
      },
      address: {
        type: 'object',
        label: 'Address',
        fields: {
          street: { type: 'text', label: 'Street Address', placeholder: '123 Main Street' },
          city: { type: 'text', label: 'City', placeholder: 'San Francisco' },
          state: { type: 'text', label: 'State/Province', placeholder: 'CA' },
          zip: { type: 'text', label: 'ZIP/Postal Code', placeholder: '94102' },
          country: { type: 'text', label: 'Country', defaultValue: 'United States' },
        },
      },
      hours: {
        type: 'text',
        label: 'Business Hours',
        placeholder: 'Mon-Fri 9am-5pm',
      },
      socialLinks: {
        type: 'array',
        label: 'Social Media',
        itemType: 'object',
        itemFields: {
          platform: {
            type: 'select',
            label: 'Platform',
            options: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'github'],
          },
          url: {
            type: 'url',
            label: 'Profile URL',
            placeholder: 'https://...',
          },
        },
      },
    },
  },

  analytics: {
    label: 'Analytics & Tracking',
    description: 'Configure analytics and tracking codes',
    icon: 'graph-up',
    fields: {
      googleAnalyticsId: {
        type: 'text',
        label: 'Google Analytics ID',
        placeholder: 'G-XXXXXXXXXX',
        description: 'Your GA4 measurement ID',
      },
      googleTagManagerId: {
        type: 'text',
        label: 'Google Tag Manager ID',
        placeholder: 'GTM-XXXXXXX',
        description: 'Your GTM container ID',
      },
      facebookPixelId: {
        type: 'text',
        label: 'Facebook Pixel ID',
        placeholder: '123456789012345',
      },
      linkedInInsightTag: {
        type: 'text',
        label: 'LinkedIn Insight Tag',
        placeholder: '123456',
      },
      hotjarId: {
        type: 'text',
        label: 'Hotjar Site ID',
        placeholder: '1234567',
      },
      customScripts: {
        type: 'object',
        label: 'Custom Scripts',
        fields: {
          head: {
            type: 'code',
            label: 'Head Scripts',
            language: 'html',
            description: 'Injected before </head>',
          },
          bodyStart: {
            type: 'code',
            label: 'Body Start Scripts',
            language: 'html',
            description: 'Injected after <body>',
          },
          bodyEnd: {
            type: 'code',
            label: 'Body End Scripts',
            language: 'html',
            description: 'Injected before </body>',
          },
        },
      },
    },
  },

  seo: {
    label: 'SEO Defaults',
    description: 'Default values for SEO meta tags',
    icon: 'search',
    fields: {
      defaultTitle: {
        type: 'text',
        label: 'Default Page Title',
        placeholder: 'Your Site Name',
        description: 'Used when page has no custom title',
      },
      titleSuffix: {
        type: 'text',
        label: 'Title Suffix',
        placeholder: ' | Your Site Name',
        description: 'Appended to all page titles',
      },
      titleSeparator: {
        type: 'select',
        label: 'Title Separator',
        options: [' | ', ' - ', ' :: ', ' > ', ' / '],
        defaultValue: ' | ',
      },
      defaultDescription: {
        type: 'textarea',
        label: 'Default Meta Description',
        placeholder: 'A brief description of your site...',
        description: 'Used when page has no custom description (150-160 chars)',
      },
      defaultImage: {
        type: 'image',
        label: 'Default OG Image',
        description: 'Used for social sharing when page has no image (1200x630px recommended)',
      },
      favicon: {
        type: 'image',
        label: 'Favicon',
        accept: '.ico,.png,.svg',
        description: 'Site favicon (32x32px recommended)',
      },
      appleTouchIcon: {
        type: 'image',
        label: 'Apple Touch Icon',
        accept: '.png',
        description: 'iOS home screen icon (180x180px)',
      },
      robotsDirective: {
        type: 'select',
        label: 'Search Engine Indexing',
        options: ['index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow'],
        defaultValue: 'index, follow',
      },
    },
  },

  branding: {
    label: 'Branding',
    description: 'Logo, colors, and typography',
    icon: 'palette',
    fields: {
      logo: {
        type: 'image',
        label: 'Logo',
        description: 'Primary logo for light backgrounds',
      },
      logoAlt: {
        type: 'image',
        label: 'Logo (Dark Mode)',
        description: 'Logo for dark backgrounds',
      },
      logoIcon: {
        type: 'image',
        label: 'Logo Icon',
        description: 'Square icon version for small spaces',
      },
      primaryColor: {
        type: 'color',
        label: 'Primary Color',
        defaultValue: '#6366f1',
        description: 'Main brand color',
      },
      secondaryColor: {
        type: 'color',
        label: 'Secondary Color',
        defaultValue: '#ec4899',
        description: 'Accent color',
      },
      backgroundColor: {
        type: 'color',
        label: 'Background Color',
        defaultValue: '#ffffff',
      },
      textColor: {
        type: 'color',
        label: 'Text Color',
        defaultValue: '#1f2937',
      },
      fontHeading: {
        type: 'select',
        label: 'Heading Font',
        options: ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Merriweather', 'Source Sans Pro', 'Raleway'],
        defaultValue: 'Inter',
      },
      fontBody: {
        type: 'select',
        label: 'Body Font',
        options: ['Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro', 'Nunito', 'PT Sans', 'Raleway'],
        defaultValue: 'Inter',
      },
      borderRadius: {
        type: 'select',
        label: 'Border Radius Style',
        options: ['none', 'small', 'medium', 'large', 'full'],
        defaultValue: 'medium',
      },
    },
  },

  integrations: {
    label: 'Integrations',
    description: 'Third-party service connections',
    icon: 'plug',
    fields: {
      formEndpoint: {
        type: 'url',
        label: 'Form Submission Endpoint',
        description: 'Default endpoint for form submissions',
      },
      emailProvider: {
        type: 'select',
        label: 'Email Provider',
        options: ['none', 'sendgrid', 'resend', 'mailgun', 'postmark'],
        defaultValue: 'none',
      },
      emailApiKey: {
        type: 'text',
        label: 'Email API Key',
        description: 'API key for email provider',
      },
      emailFromAddress: {
        type: 'email',
        label: 'From Email Address',
        placeholder: 'noreply@yourdomain.com',
      },
      emailFromName: {
        type: 'text',
        label: 'From Name',
        placeholder: 'Your Business Name',
      },
      mapsApiKey: {
        type: 'text',
        label: 'Google Maps API Key',
        description: 'For map embeds and location features',
      },
    },
  },

  legal: {
    label: 'Legal Pages',
    description: 'Links to legal documents',
    icon: 'file-earmark-text',
    fields: {
      privacyPolicyUrl: {
        type: 'url',
        label: 'Privacy Policy URL',
        placeholder: '/privacy',
      },
      termsOfServiceUrl: {
        type: 'url',
        label: 'Terms of Service URL',
        placeholder: '/terms',
      },
      cookiePolicyUrl: {
        type: 'url',
        label: 'Cookie Policy URL',
        placeholder: '/cookies',
      },
      showCookieBanner: {
        type: 'boolean',
        label: 'Show Cookie Consent Banner',
        defaultValue: true,
      },
    },
  },
};

/**
 * Default global settings values
 */
export function getDefaultSettings(): Record<string, any> {
  const defaults: Record<string, any> = {};

  for (const [categoryKey, category] of Object.entries(GLOBAL_SETTINGS_SCHEMA)) {
    defaults[categoryKey] = {};
    for (const [fieldKey, field] of Object.entries(category.fields)) {
      if (field.defaultValue !== undefined) {
        defaults[categoryKey][fieldKey] = field.defaultValue;
      } else if (field.type === 'object' && field.fields) {
        defaults[categoryKey][fieldKey] = {};
        for (const [subKey, subField] of Object.entries(field.fields)) {
          if (subField.defaultValue !== undefined) {
            defaults[categoryKey][fieldKey][subKey] = subField.defaultValue;
          }
        }
      } else if (field.type === 'array') {
        defaults[categoryKey][fieldKey] = [];
      }
    }
  }

  return defaults;
}

/**
 * Validate settings against schema
 */
export function validateSettings(settings: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [categoryKey, category] of Object.entries(GLOBAL_SETTINGS_SCHEMA)) {
    const categorySettings = settings[categoryKey] || {};

    for (const [fieldKey, field] of Object.entries(category.fields)) {
      const value = categorySettings[fieldKey];

      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${category.label}: ${field.label} is required`);
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== '') {
        if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`${category.label}: ${field.label} must be a valid email`);
        }
        if (field.type === 'url') {
          try {
            new URL(value);
          } catch {
            errors.push(`${category.label}: ${field.label} must be a valid URL`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get a nested setting value using dot notation
 * e.g., getSettingValue(settings, 'business.address.city')
 */
export function getSettingValue(settings: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let value = settings;

  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }

  return value;
}

/**
 * Set a nested setting value using dot notation
 */
export function setSettingValue(settings: Record<string, any>, path: string, value: any): Record<string, any> {
  const parts = path.split('.');
  const result = { ...settings };
  let current = result;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    current[part] = { ...current[part] };
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  return result;
}

/**
 * Generate CSS custom properties from branding settings
 */
export function generateBrandingCSS(branding: Record<string, any>): string {
  const borderRadiusMap: Record<string, string> = {
    none: '0',
    small: '0.25rem',
    medium: '0.5rem',
    large: '1rem',
    full: '9999px',
  };

  return `:root {
  --brand-primary: ${branding.primaryColor || '#6366f1'};
  --brand-secondary: ${branding.secondaryColor || '#ec4899'};
  --brand-background: ${branding.backgroundColor || '#ffffff'};
  --brand-text: ${branding.textColor || '#1f2937'};
  --font-heading: '${branding.fontHeading || 'Inter'}', sans-serif;
  --font-body: '${branding.fontBody || 'Inter'}', sans-serif;
  --border-radius: ${borderRadiusMap[branding.borderRadius] || '0.5rem'};
}`;
}

/**
 * Generate analytics script tags
 */
export function generateAnalyticsScripts(analytics: Record<string, any>): { head: string; body: string } {
  const headScripts: string[] = [];
  const bodyScripts: string[] = [];

  // Google Analytics 4
  if (analytics.googleAnalyticsId) {
    headScripts.push(`<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${analytics.googleAnalyticsId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${analytics.googleAnalyticsId}');
</script>`);
  }

  // Google Tag Manager
  if (analytics.googleTagManagerId) {
    headScripts.push(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${analytics.googleTagManagerId}');</script>`);

    bodyScripts.push(`<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${analytics.googleTagManagerId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`);
  }

  // Facebook Pixel
  if (analytics.facebookPixelId) {
    headScripts.push(`<!-- Facebook Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${analytics.facebookPixelId}');
fbq('track', 'PageView');
</script>`);
  }

  // Custom scripts
  if (analytics.customScripts?.head) {
    headScripts.push(analytics.customScripts.head);
  }
  if (analytics.customScripts?.bodyStart) {
    bodyScripts.unshift(analytics.customScripts.bodyStart);
  }
  if (analytics.customScripts?.bodyEnd) {
    bodyScripts.push(analytics.customScripts.bodyEnd);
  }

  return {
    head: headScripts.join('\n'),
    body: bodyScripts.join('\n'),
  };
}

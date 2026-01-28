/**
 * page-types.ts — Page type definitions and suggested components
 *
 * Pages have a defined type that influences component suggestions,
 * schema generation, and optimization rules.
 */

export interface PageType {
  id: string;
  name: string;
  description: string;
  suggestedComponents: string[];
  defaultSchema: string;
}

export const PAGE_TYPES: PageType[] = [
  {
    id: 'landing',
    name: 'Landing Page',
    description: 'Main conversion-focused pages',
    suggestedComponents: ['hero', 'features', 'testimonials', 'cta', 'pricing', 'faq'],
    defaultSchema: 'WebPage',
  },
  {
    id: 'blog',
    name: 'Blog Post',
    description: 'Article or blog content',
    suggestedComponents: ['blog-header', 'rich-text', 'author-bio', 'related-posts', 'comments'],
    defaultSchema: 'Article',
  },
  {
    id: 'pricing',
    name: 'Pricing Page',
    description: 'Product/service pricing',
    suggestedComponents: ['pricing-header', 'pricing-grid', 'pricing-comparison', 'faq', 'cta'],
    defaultSchema: 'Product',
  },
  {
    id: 'about',
    name: 'About Page',
    description: 'Company/team information',
    suggestedComponents: ['about-hero', 'team-grid', 'timeline', 'values', 'stats'],
    defaultSchema: 'AboutPage',
  },
  {
    id: 'contact',
    name: 'Contact Page',
    description: 'Contact information and forms',
    suggestedComponents: ['contact-hero', 'contact-form', 'map', 'office-locations', 'faq'],
    defaultSchema: 'ContactPage',
  },
  {
    id: 'product',
    name: 'Product Page',
    description: 'Individual product details',
    suggestedComponents: ['product-gallery', 'product-info', 'reviews', 'related-products', 'faq'],
    defaultSchema: 'Product',
  },
  {
    id: 'service',
    name: 'Service Page',
    description: 'Service offering details',
    suggestedComponents: ['service-hero', 'service-features', 'process', 'testimonials', 'cta', 'faq'],
    defaultSchema: 'Service',
  },
  {
    id: 'portfolio',
    name: 'Portfolio Page',
    description: 'Showcase work and projects',
    suggestedComponents: ['portfolio-hero', 'portfolio-grid', 'case-study', 'testimonials', 'cta'],
    defaultSchema: 'WebPage',
  },
  {
    id: 'faq',
    name: 'FAQ Page',
    description: 'Frequently asked questions',
    suggestedComponents: ['faq-hero', 'faq-accordion', 'faq-categories', 'contact-cta'],
    defaultSchema: 'FAQPage',
  },
  {
    id: 'custom',
    name: 'Custom Page',
    description: 'No predefined structure',
    suggestedComponents: [],
    defaultSchema: 'WebPage',
  },
];

/**
 * Get a page type by ID
 */
export function getPageType(id: string): PageType | undefined {
  return PAGE_TYPES.find(pt => pt.id === id);
}

/**
 * Get suggested components for a page type
 */
export function getSuggestedComponents(pageTypeId: string): string[] {
  const pageType = getPageType(pageTypeId);
  return pageType?.suggestedComponents || [];
}

/**
 * Get the default schema type for a page type
 */
export function getDefaultSchema(pageTypeId: string): string {
  const pageType = getPageType(pageTypeId);
  return pageType?.defaultSchema || 'WebPage';
}

/**
 * Check if a page type requires FAQ section for optimization
 */
export function requiresFAQ(pageTypeId: string): boolean {
  return ['landing', 'product', 'service', 'pricing'].includes(pageTypeId);
}

/**
 * Get page types as options for select inputs
 */
export function getPageTypeOptions(): { value: string; label: string }[] {
  return PAGE_TYPES.map(pt => ({
    value: pt.id,
    label: pt.name,
  }));
}

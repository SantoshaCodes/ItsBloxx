const BASE_URL = process.env.XANO_API_BASE!;

export interface Template {
  type: string;
  category: string;
  required_fields: Record<string, string>;
  optional_fields: Record<string, string>;
  ai_prompt_template: string;
  example_structure: {
    html: string;
    styles: Record<string, any>;
    data?: Record<string, any>;
    schema?: object;
  };
  use_cases: string[];
  tags: string[];
}

export interface ComponentInput {
  name: string;
  type: string;
  category: string;
  html: string;
  styles: Record<string, any>;
  data: Record<string, any>;
  schema: { '@type'?: string; '@context'?: string; [key: string]: any };
  visibility: 'public' | 'private' | 'organization';
  tags?: string[];
}

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch(`${BASE_URL}/templates/components`);
  if (!res.ok) throw new Error(`Failed to fetch templates: ${res.status}`);
  return res.json();
}

export async function createComponent(component: ComponentInput): Promise<{ success: boolean; short_id?: string }> {
  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY RUN] Would create component "${component.name}" (${component.type}):`);
    console.log(`  HTML: ${component.html.length} chars`);
    console.log(`  Styles: ${Object.keys(component.styles).length} rules`);
    console.log(`  Schema: ${component.schema?.['@type'] || 'none'}`);
    return { success: true, short_id: 'dry-run-id' };
  }

  const res = await fetch(`${BASE_URL}/component/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(component)
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create component: ${res.status} - ${error}`);
  }

  const result = await res.json();
  return { success: true, short_id: result.component?.short_id };
}

// Keep for backwards compatibility during transition
export async function updateTemplate(
  type: string,
  exampleStructure: object,
  variants?: object[]
): Promise<{ success: boolean }> {
  console.log(`[DEPRECATED] updateTemplate called for ${type} - use createComponent instead`);
  return { success: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE TEMPLATE API
// ═══════════════════════════════════════════════════════════════════════════

export interface PageTemplateInput {
  type: string;
  name: string;
  schemaType: string;
  html: string;
  schema: { '@context': string; '@type': string; [key: string]: any };
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
  data: Record<string, any>;
  sections: string[];
  score: number;
  tags?: string[];
}

export interface PageTemplateRecord {
  short_id: string;
  type: string;
  name: string;
  schemaType: string;
  html: string;
  schema: object;
  meta: object;
  data: object;
  sections: string[];
  score: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export async function createTemplate(
  template: PageTemplateInput
): Promise<{ success: boolean; short_id?: string }> {
  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY RUN] Would create page template "${template.name}" (${template.type}):`);
    console.log(`  HTML: ${template.html.length} chars`);
    console.log(`  Schema: ${template.schemaType}`);
    console.log(`  Sections: ${template.sections.join(', ')}`);
    console.log(`  Score: ${template.score}/100`);
    return { success: true, short_id: `dry-run-${template.type.toLowerCase()}` };
  }

  const res = await fetch(`${BASE_URL}/template/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: template.type,
      name: template.name,
      schema_type: template.schemaType,
      html: template.html,
      schema: template.schema,
      meta: template.meta,
      data: template.data,
      sections: template.sections,
      score: template.score,
      tags: template.tags || [],
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to create page template: ${res.status} - ${error}`);
  }

  const result = await res.json();
  return { success: true, short_id: result.template?.short_id || result.short_id };
}

export async function getTemplate(
  shortId: string
): Promise<PageTemplateRecord | null> {
  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY RUN] Would fetch page template: ${shortId}`);
    return null;
  }

  const res = await fetch(`${BASE_URL}/template/render?short_id=${encodeURIComponent(shortId)}`);

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    const error = await res.text();
    throw new Error(`Failed to fetch page template: ${res.status} - ${error}`);
  }

  return res.json();
}

export async function listTemplates(
  type?: string
): Promise<PageTemplateRecord[]> {
  if (process.env.DRY_RUN === 'true') {
    console.log(`[DRY RUN] Would list page templates${type ? ` of type ${type}` : ''}`);
    return [];
  }

  const url = type
    ? `${BASE_URL}/template/list?type=${encodeURIComponent(type)}`
    : `${BASE_URL}/template/list`;

  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to list page templates: ${res.status} - ${error}`);
  }

  return res.json();
}

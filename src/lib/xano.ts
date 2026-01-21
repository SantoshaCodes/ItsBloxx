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
  schema: object;
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

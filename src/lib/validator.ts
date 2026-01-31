import type { EnrichedComponent } from './gemini';

export interface ValidationResult {
  valid: boolean;
  score: number;
  issues: string[];
}

export function validate(component: EnrichedComponent): ValidationResult {
  const issues: string[] = [];
  let score = 100;

  // HTML checks
  if (!component.html || component.html.length < 300) {
    issues.push(`HTML too short: ${component.html?.length || 0} chars (min: 300)`);
    score -= 20;
  }

  if (!/section|article|header|footer|nav|main/.test(component.html)) {
    issues.push('Missing semantic HTML elements');
    score -= 15;
  }

  if (!/aria-label|aria-labelledby|role=/.test(component.html)) {
    issues.push('Missing ARIA attributes');
    score -= 15;
  }

  if (!/<h[1-6]/.test(component.html)) {
    issues.push('Missing heading elements');
    score -= 10;
  }

  if (!/\{\{[a-zA-Z]+\}\}/.test(component.html)) {
    issues.push('No template variables found');
    score -= 10;
  }

  // Tailwind CSS checks
  const hasTailwindClasses = /class="[^"]*(?:flex|grid|p-|m-|text-|bg-|rounded|shadow)[^"]*"/.test(component.html);
  if (!hasTailwindClasses) {
    issues.push('Missing Tailwind utility classes');
    score -= 15;
  }

  // Check for responsive classes
  const hasResponsive = /class="[^"]*(?:sm:|md:|lg:|xl:)[^"]*"/.test(component.html);
  if (!hasResponsive) {
    issues.push('Missing responsive breakpoints (sm:, md:, lg:)');
    score -= 10;
  }

  // Check for hover/focus states
  const hasInteractiveStates = /class="[^"]*(?:hover:|focus:)[^"]*"/.test(component.html);
  if (!hasInteractiveStates) {
    issues.push('Missing hover/focus states');
    score -= 10;
  }

  // Schema checks
  if (!component.schema?.['@type']) {
    issues.push('Missing Schema.org @type');
    score -= 10;
  }

  if (!component.schema?.['@context']) {
    issues.push('Missing Schema.org @context');
    score -= 5;
  }

  return {
    valid: score >= 80,
    score: Math.max(0, score),
    issues
  };
}

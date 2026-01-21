import 'dotenv/config';
import { readFileSync } from 'fs';
import { enrichComponent } from './lib/gemini';
import { validate } from './lib/validator';

const BASE_URL = process.env.XANO_API_BASE!;
const CONCURRENCY = 5;
const MAX_RETRIES = 3;

interface ComponentRow {
  id: string;
  short_id: string;
  name: string;
  category: string;
  type: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCSV(filepath: string): ComponentRow[] {
  const content = readFileSync(filepath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const idIdx = headers.indexOf('id');
  const shortIdIdx = headers.indexOf('short_id');
  const nameIdx = headers.indexOf('name');
  const categoryIdx = headers.indexOf('category');
  const typeIdx = headers.indexOf('type');

  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      // Handle CSV with potential commas in quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current);

      return {
        id: values[idIdx] || '',
        short_id: values[shortIdIdx] || '',
        name: values[nameIdx] || '',
        category: values[categoryIdx] || '',
        type: values[typeIdx] || ''
      };
    })
    .filter(row => row.type && row.type !== 'null' && row.type.trim() !== '');
}

async function editComponent(
  shortId: string,
  name: string,
  html: string,
  styles: Record<string, any>,
  data: Record<string, any>,
  schema: Record<string, any>
): Promise<{ success: boolean }> {
  if (process.env.DRY_RUN === 'true') {
    console.log(`    [DRY RUN] Would update ${shortId}: ${html.length} chars HTML, ${Object.keys(styles).length} style rules`);
    return { success: true };
  }

  const res = await fetch(`${BASE_URL}/component/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_id: shortId,
      name: name,
      html: html,
      styles: styles,
      data: data,
      schema: schema
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to edit component: ${res.status} - ${error}`);
  }

  return { success: true };
}

async function processComponent(row: ComponentRow): Promise<{ shortId: string; success: boolean; score?: number }> {
  const { short_id, name, type, category } = row;

  console.log(`\n━━━ ${short_id}: ${type} (${name || 'unnamed'}) ━━━`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  Attempt ${attempt}/${MAX_RETRIES}...`);

      // Generate enriched content
      console.log('  → Generating with Gemini...');
      const enriched = await enrichComponent(type, name, category);

      // Validate
      console.log('  → Validating...');
      const validation = validate(enriched);

      if (!validation.valid && attempt < MAX_RETRIES) {
        console.log(`  ⚠️ Score: ${validation.score}/100`);
        validation.issues.forEach(i => console.log(`     - ${i}`));
        await sleep(1000);
        continue;
      }

      // Update component
      console.log('  → Updating component...');
      const componentName = name || `${type} - Default`;
      await editComponent(
        short_id,
        componentName,
        enriched.html,
        enriched.styles,
        enriched.data,
        enriched.schema
      );

      console.log(`  ✅ Done! Score: ${validation.score}/100`);
      return { shortId: short_id, success: true, score: validation.score };

    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      if (attempt < MAX_RETRIES) await sleep(2000);
    }
  }

  return { shortId: short_id, success: false };
}

async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  delayMs: number = 500
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      const result = await processor(items[currentIndex]);
      results.push(result);
      await sleep(delayMs);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('🚀 Bloxx Component Enrichment Pipeline\n');
  console.log(`Mode: ${process.env.DRY_RUN === 'true' ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Concurrency: ${CONCURRENCY} parallel workers\n`);

  // Load components from CSV
  console.log('📋 Loading components from CSV...');
  const components = parseCSV('./components.csv');
  console.log(`   Found ${components.length} components with types to process\n`);

  // Show type distribution
  const typeCounts: Record<string, number> = {};
  components.forEach(c => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });
  console.log('Type distribution:');
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([type, count]) => console.log(`  ${type}: ${count}`));
  console.log('  ...\n');

  // Process all components
  const results = await processWithConcurrency(
    components,
    processComponent,
    CONCURRENCY,
    1000 // 1 second delay between requests per worker
  );

  // Summary
  console.log('\n\n════════════════════════════════');
  console.log('         SUMMARY');
  console.log('════════════════════════════════\n');

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Succeeded: ${succeeded.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (succeeded.length > 0) {
    const avgScore = succeeded.reduce((sum, r) => sum + (r.score || 0), 0) / succeeded.length;
    console.log(`📊 Average Score: ${avgScore.toFixed(1)}/100`);
  }

  if (failed.length > 0 && failed.length <= 20) {
    console.log('\nFailed components:');
    failed.forEach(f => console.log(`  - ${f.shortId}`));
  } else if (failed.length > 20) {
    console.log(`\nFailed components: ${failed.length} (too many to list)`);
  }
}

main().catch(console.error);

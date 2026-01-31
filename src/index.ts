import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { enrichComponent, judgeComponent, EnrichedComponent, PreviousFeedback } from './lib/gemini';

const BASE_URL = process.env.XANO_API_BASE!;
const CONCURRENCY = 4;  // Claude API is more stable
const MAX_RETRIES = 4;
const PASS_THRESHOLD = 90;
const PROGRESS_FILE = './progress.json';

// Valid component types (PascalCase, no CSS-like colons)
const VALID_TYPE_PATTERN = /^[A-Z][a-zA-Z0-9]*$/;

function isValidComponentType(type: string): boolean {
  if (type.includes(':')) return false;
  if (type.includes('{') || type.includes('}')) return false;
  return VALID_TYPE_PATTERN.test(type);
}

interface ComponentRow {
  id: string;
  short_id: string;
  name: string;
  category: string;
  type: string;
}

interface ProcessResult {
  shortId: string;
  success: boolean;
  score?: number;
  attempts?: number;
  issues?: string[];
}

interface Progress {
  completed: string[];
  failed: string[];
  lastRun: string;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add ±20% jitter to prevent synchronized retry storms
function jitter(ms: number): number {
  const variance = ms * 0.2;
  return ms + (Math.random() * variance * 2 - variance);
}

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { completed: [], failed: [], lastRun: new Date().toISOString() };
}

function saveProgress(progress: Progress) {
  progress.lastRun = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
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
    .filter(row => row.type && row.type !== 'null' && row.type.trim() !== '' && isValidComponentType(row.type));
}

async function editComponent(
  shortId: string,
  name: string,
  enriched: EnrichedComponent
): Promise<{ success: boolean }> {
  if (process.env.DRY_RUN === 'true') {
    console.log(`    [DRY RUN] Would update ${shortId}: ${enriched.html.length} chars HTML (Tailwind)`);
    return { success: true };
  }

  const res = await fetch(`${BASE_URL}/component/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_id: shortId,
      name: name,
      html: enriched.html,
      styles: {},  // Empty - all styling is now in Tailwind classes
      data: enriched.data,
      schema: enriched.schema,
      meta: enriched.meta
    })
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to edit component: ${res.status} - ${error}`);
  }

  return { success: true };
}

async function processComponent(row: ComponentRow, progress: Progress, workerId: number): Promise<ProcessResult> {
  const { short_id, name, type, category } = row;
  const tag = `[W${workerId}]`;

  // Skip if already completed
  if (progress.completed.includes(short_id)) {
    console.log(`\n${tag} ⏭️  ${short_id}: ${type} - Already completed, skipping`);
    return { shortId: short_id, success: true, score: 100, attempts: 0 };
  }

  console.log(`\n${tag} ━━━ ${short_id}: ${type} (${name || 'unnamed'}) ━━━`);

  let bestResult: EnrichedComponent | null = null;
  let bestScore = 0;
  let lastIssues: string[] = [];
  let previousFeedback: PreviousFeedback | undefined = undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`${tag}   Attempt ${attempt}/${MAX_RETRIES}...`);

      // Generate with Pro (pass feedback from previous attempt if retry)
      if (previousFeedback) {
        console.log(`${tag}   → Generating with Claude Opus (with feedback)...`);
      } else {
        console.log(`${tag}   → Generating with Claude Opus...`);
      }
      const enriched = await enrichComponent(type, name, category, previousFeedback);

      // Log generated output
      console.log(`${tag}   ┌─── GENERATED OUTPUT ───`);
      console.log(`${tag}   │ HTML: ${enriched.html.length} chars (Tailwind)`);
      console.log(`${tag}   │ Schema: @type="${enriched.schema?.['@type']}"`);
      console.log(`${tag}   │ Meta: ${enriched.meta?.title || 'N/A'}`);
      console.log(`${tag}   └─────────────────────────`);

      // Judge with Flash
      console.log(`${tag}   → Judging with Claude Sonnet...`);
      const judgment = await judgeComponent(enriched, type);

      // Log judge output
      console.log(`${tag}   ┌─── JUDGE VERDICT ───`);
      console.log(`${tag}   │ Score: ${judgment.score}/100 ${judgment.passed ? '✅ PASS' : '❌ FAIL'}`);
      if (judgment.issues.length > 0) {
        judgment.issues.slice(0, 2).forEach(i => console.log(`${tag}   │ • ${i.slice(0, 80)}...`));
      }
      console.log(`${tag}   └──────────────────────`);

      // Track best result
      if (judgment.score > bestScore) {
        bestScore = judgment.score;
        bestResult = enriched;
        lastIssues = judgment.issues;
      }

      if (judgment.passed) {
        // Passed! Update component
        console.log(`${tag}   → Updating component...`);
        const componentName = name || `${type} - Default`;
        await editComponent(short_id, componentName, enriched);

        console.log(`${tag}   ✅ PASSED! Score: ${judgment.score}/100`);
        progress.completed.push(short_id);
        saveProgress(progress);

        return { shortId: short_id, success: true, score: judgment.score, attempts: attempt };
      }

      // Didn't pass - store feedback for next attempt
      previousFeedback = {
        score: judgment.score,
        issues: judgment.issues,
        suggestions: judgment.suggestions
      };

      if (attempt < MAX_RETRIES) {
        const backoffMs = jitter(2000 * Math.pow(1.5, attempt - 1));
        console.log(`${tag}   ⏳ Retrying in ${(backoffMs / 1000).toFixed(1)}s...`);
        await sleep(backoffMs);
      }

    } catch (error: any) {
      console.log(`${tag}   ❌ Error: ${error.message}`);
      if (attempt < MAX_RETRIES) {
        // Longer delay for 504/timeout errors to let server recover
        const is504 = error.message?.includes('504') || error.message?.includes('DEADLINE');
        const baseDelay = is504 ? 8000 : 3000;  // 8s base for 504s
        const backoffMs = jitter(baseDelay * Math.pow(1.5, attempt - 1));
        console.log(`${tag}   ⏳ Waiting ${(backoffMs / 1000).toFixed(1)}s...`);
        await sleep(backoffMs);
      }
    }
  }

  // All retries exhausted - use best result if score >= 80
  if (bestResult && bestScore >= 80) {
    console.log(`${tag}   ⚠️ Using best attempt (${bestScore}/100)...`);
    try {
      const componentName = name || `${type} - Default`;
      await editComponent(short_id, componentName, bestResult);
      progress.completed.push(short_id);
      saveProgress(progress);
      return { shortId: short_id, success: true, score: bestScore, attempts: MAX_RETRIES, issues: lastIssues };
    } catch (e: any) {
      console.log(`${tag}   ❌ Failed to save: ${e.message}`);
    }
  }

  console.log(`${tag}   ❌ FAILED after ${MAX_RETRIES} attempts (best: ${bestScore})`);
  progress.failed.push(short_id);
  saveProgress(progress);

  return { shortId: short_id, success: false, score: bestScore, attempts: MAX_RETRIES, issues: lastIssues };
}

async function processWithConcurrency(
  items: ComponentRow[],
  progress: Progress,
  concurrency: number,
  delayMs: number = 2000
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  let index = 0;

  async function worker(workerId: number) {
    // Stagger worker starts to avoid concurrent request collision
    // Worker 0 starts immediately, Worker 1 waits ~10s, Worker 2 waits ~20s
    const staggerDelay = jitter(workerId * 10000);
    if (staggerDelay > 0) {
      console.log(`  [Worker ${workerId}] Starting in ${(staggerDelay / 1000).toFixed(1)}s (staggered)...`);
      await sleep(staggerDelay);
    }

    while (index < items.length) {
      const currentIndex = index++;
      const result = await processComponent(items[currentIndex], progress, workerId);
      results.push(result);
      await sleep(jitter(delayMs));
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map((_, i) => worker(i));

  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('Bloxx Component Enrichment Pipeline v4 (Bootstrap 5)\n');
  console.log('----------------------------------------');
  console.log('  Generator: Claude Opus 4.5');
  console.log('  Judge:     Claude Sonnet 4');
  console.log('  CSS:       Bootstrap 5 (utility classes)');
  console.log('  Threshold: ' + PASS_THRESHOLD + '/100');
  console.log('----------------------------------------\n');
  console.log(`Mode: ${process.env.DRY_RUN === 'true' ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Concurrency: ${CONCURRENCY} parallel workers`);
  console.log(`Max retries: ${MAX_RETRIES} per component\n`);

  // Load progress
  const progress = loadProgress();
  console.log(`📁 Progress: ${progress.completed.length} completed, ${progress.failed.length} failed`);

  // Load components from CSV
  console.log('📋 Loading components from CSV...');
  const allComponents = parseCSV('./components.csv');

  // Filter out already completed
  const components = allComponents.filter(c => !progress.completed.includes(c.short_id));
  console.log(`   Total: ${allComponents.length} | Remaining: ${components.length}\n`);

  if (components.length === 0) {
    console.log('✅ All components already processed!');
    return;
  }

  // Show type distribution
  const typeCounts: Record<string, number> = {};
  components.forEach(c => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });
  console.log('Remaining type distribution:');
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([type, count]) => console.log(`  ${type}: ${count}`));
  console.log('');

  // Process components
  const startTime = Date.now();
  const results = await processWithConcurrency(components, progress, CONCURRENCY, 5000);  // 5s delay between components
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  // Summary
  console.log('\n\n════════════════════════════════════════');
  console.log('              FINAL SUMMARY');
  console.log('════════════════════════════════════════\n');

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgScore = succeeded.length > 0
    ? succeeded.reduce((sum, r) => sum + (r.score || 0), 0) / succeeded.length
    : 0;
  const avgAttempts = succeeded.filter(r => r.attempts && r.attempts > 0).length > 0
    ? succeeded.filter(r => r.attempts && r.attempts > 0).reduce((sum, r) => sum + (r.attempts || 0), 0) / succeeded.filter(r => r.attempts && r.attempts > 0).length
    : 0;

  console.log(`⏱️  Time: ${elapsed} minutes`);
  console.log(`✅ Passed: ${succeeded.length}/${results.length} (${((succeeded.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📊 Avg Score: ${avgScore.toFixed(1)}/100`);
  console.log(`🔄 Avg Attempts: ${avgAttempts.toFixed(1)}`);

  console.log(`\n📁 Total Progress: ${progress.completed.length}/${allComponents.length} complete`);

  if (failed.length > 0 && failed.length <= 20) {
    console.log('\nFailed components:');
    failed.forEach(f => console.log(`  - ${f.shortId} (best: ${f.score})`));
  } else if (failed.length > 20) {
    console.log(`\nFailed: ${failed.length} components (see progress.json)`);
  }
}

main().catch(console.error);

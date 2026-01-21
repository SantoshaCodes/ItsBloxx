import 'dotenv/config';
import { fetchTemplates, createComponent, type ComponentInput } from './lib/xano';
import { enrichComponent, generateVariant } from './lib/gemini';
import { validate } from './lib/validator';

// Component types to process (in priority order)
const TYPES_TO_PROCESS = [
  'Hero', 'FAQPage', 'Footer', 'Navbar', 'FeaturesGrid',
  'Testimonial', 'CTA', 'PricingCard', 'BlogPost', 'Product',
  'Form', 'Article', 'Video', 'Location', 'Event', 'Service',
  'Person', 'Organization', 'TeamGrid', 'PricingGrid',
  'TestimonialCarousel', 'ReviewList', 'BreadcrumbList', 'HowTo'
];

// Variants to generate for key component types
const VARIANT_CONFIG: Record<string, string[]> = {
  Hero: ['Split', 'Minimal', 'Gradient', 'WithForm'],
  CTA: ['Centered', 'Split', 'Banner'],
  Testimonial: ['Card', 'Quote', 'Carousel'],
  FeaturesGrid: ['IconGrid', 'CardGrid', 'Alternating'],
  PricingCard: ['Basic', 'Popular', 'Enterprise']
};

const MAX_RETRIES = 3;
const CONCURRENCY = 5; // Process 5 components at a time

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Process items with concurrency limit
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      executing.splice(0, executing.findIndex(p => p === promise) + 1);
    }
  }

  await Promise.all(executing);
  return results;
}

async function processType(template: any): Promise<{ type: string; success: boolean; count: number }> {
  const type = template.type;
  if (!type) return { type: '', success: false, count: 0 };

  console.log(`\n━━━ Processing: ${type} ━━━`);
  const createdComponents: string[] = [];

  // Generate base component
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`  Attempt ${attempt}/${MAX_RETRIES} for base component...`);

    try {
      console.log('  → Calling Gemini API...');
      const enriched = await enrichComponent(
        type,
        template.example_structure?.html || '',
        template.required_fields || {},
        template.use_cases || []
      );

      console.log('  → Validating...');
      const validation = validate(enriched);

      if (!validation.valid && attempt < MAX_RETRIES) {
        console.log(`  ⚠️ Score: ${validation.score}/100`);
        validation.issues.forEach(i => console.log(`     - ${i}`));
        await sleep(1000);
        continue;
      }

      // Create the base component
      const componentInput: ComponentInput = {
        name: `${type} - Default`,
        type: type,
        category: template.category || 'atomic',
        html: enriched.html,
        styles: enriched.styles,
        data: enriched.data,
        schema: enriched.schema,
        visibility: 'public',
        tags: template.tags || []
      };

      console.log('  → Creating component...');
      const result = await createComponent(componentInput);

      if (result.success) {
        createdComponents.push(result.short_id || 'created');
        console.log(`  ✅ Base component created! Score: ${validation.score}`);
      }

      break;
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      if (attempt < MAX_RETRIES) await sleep(2000);
    }
  }

  // Generate variants in parallel if configured
  if (VARIANT_CONFIG[type] && createdComponents.length > 0) {
    console.log(`  → Generating ${VARIANT_CONFIG[type].length} variants in parallel...`);

    const variantResults = await Promise.allSettled(
      VARIANT_CONFIG[type].map(async (variantName) => {
        try {
          const variant = await generateVariant(
            type,
            variantName,
            template.required_fields || {}
          );

          const variantInput: ComponentInput = {
            name: `${type} - ${variantName}`,
            type: type,
            category: template.category || 'atomic',
            html: variant.html,
            styles: variant.styles,
            data: {},
            schema: { '@context': 'https://schema.org', '@type': type },
            visibility: 'public',
            tags: [...(template.tags || []), variantName.toLowerCase()]
          };

          const result = await createComponent(variantInput);
          if (result.success) {
            console.log(`     ✅ Variant "${variantName}" created`);
            return result.short_id || 'created';
          }
          return null;
        } catch (error: any) {
          console.log(`     ❌ Variant "${variantName}" failed: ${error.message}`);
          return null;
        }
      })
    );

    variantResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        createdComponents.push(r.value);
      }
    });
  }

  return { type, success: createdComponents.length > 0, count: createdComponents.length };
}

async function main() {
  console.log('🚀 Bloxx Component Library Builder\n');
  console.log(`Mode: ${process.env.DRY_RUN === 'true' ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Concurrency: ${CONCURRENCY} parallel processes\n`);

  // Fetch templates for field definitions
  console.log('📋 Fetching template definitions...');
  const templates = await fetchTemplates();
  console.log(`   Found ${templates.length} template definitions`);

  // Filter to types we want to process
  const toProcess = templates.filter(t => TYPES_TO_PROCESS.includes(t.type));
  console.log(`   Processing ${toProcess.length} types with ${CONCURRENCY}x parallelism`);

  // Process types with concurrency
  const results = await processWithConcurrency(
    toProcess,
    processType,
    CONCURRENCY
  );

  // Summary
  console.log('\n\n════════════════════════════════');
  console.log('         SUMMARY');
  console.log('════════════════════════════════\n');

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalComponents = results.reduce((sum, r) => sum + r.count, 0);

  console.log(`✅ Types processed: ${succeeded.length}/${results.length}`);
  console.log(`📦 Components created: ${totalComponents}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed types:');
    failed.forEach(f => console.log(`  - ${f.type}`));
  }

  console.log('\nComponents by type:');
  results.filter(r => r.count > 0).forEach(r => {
    console.log(`  ${r.type}: ${r.count} component(s)`);
  });
}

main().catch(console.error);

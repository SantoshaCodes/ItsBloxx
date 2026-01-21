import 'dotenv/config';
import { enrichComponent } from './src/lib/gemini';
import { validate } from './src/lib/validator';
import { createComponent } from './src/lib/xano';

async function test() {
  console.log('Testing Hero enrichment...\n');

  const result = await enrichComponent(
    'Hero',
    '<section><h1>{{headline}}</h1></section>',
    { headline: 'string', subheading: 'string', ctaText: 'string' },
    ['Landing pages', 'Marketing']
  );

  console.log('HTML:', result.html.slice(0, 200) + '...');
  console.log('\nHTML length:', result.html.length);
  console.log('Styles:', Object.keys(result.styles).length, 'rules');
  console.log('Schema:', result.schema['@type']);
  console.log('Data keys:', Object.keys(result.data));

  const validation = validate(result);
  console.log('\nValidation Score:', validation.score);
  console.log('Valid:', validation.valid);
  if (validation.issues.length > 0) {
    console.log('Issues:', validation.issues);
  }

  // Try creating the component
  console.log('\n--- Testing Component Creation ---');
  const createResult = await createComponent({
    name: 'Hero - Test',
    type: 'Hero',
    category: 'atomic',
    html: result.html,
    styles: result.styles,
    data: result.data,
    schema: result.schema,
    visibility: 'public'
  });

  console.log('Create result:', createResult);
}

test().catch(console.error);

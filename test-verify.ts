import 'dotenv/config';
import { enrichComponent } from './src/lib/gemini';
import { validate } from './src/lib/validator';

async function test() {
  console.log('Testing Hero with improved prompts...\n');

  const result = await enrichComponent(
    'Hero',
    '<section><h1>{{headline}}</h1></section>',
    { headline: 'string', subheading: 'string', ctaText: 'string' },
    ['Landing pages', 'Marketing']
  );

  console.log('=== FULL HTML ===');
  console.log(result.html);

  console.log('\n=== STYLES ===');
  console.log(JSON.stringify(result.styles, null, 2));

  console.log('\n=== VALIDATION CHECKS ===');
  console.log('Has aria-label/aria-labelledby:', /aria-label/.test(result.html));
  console.log('Has semantic element:', /section|article|header|footer|nav|main/.test(result.html));
  console.log('Has heading:', /<h[1-6]/.test(result.html));
  console.log('Has @media breakpoint:', Object.keys(result.styles).some(k => k.includes('@media')));
  console.log('Style count:', Object.keys(result.styles).length);

  const validation = validate(result);
  console.log('\n=== FINAL SCORE ===');
  console.log('Score:', validation.score);
  console.log('Issues:', validation.issues.length === 0 ? 'None!' : validation.issues);
}

test().catch(console.error);

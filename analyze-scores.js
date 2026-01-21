import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./templates-export.json', 'utf-8'));

// Score each template
const scored = data.map(t => {
  const htmlLen = t.example_structure?.html?.length || 0;
  const styleCount = Object.keys(t.example_structure?.styles || {}).length;
  const hasSchema = t.example_structure?.schema ? true : false;
  const score = Math.min(100, Math.round((htmlLen / 400) * 50 + (styleCount / 10) * 30 + (hasSchema ? 20 : 0)));
  return { type: t.type || '(empty)', htmlLen, styleCount, hasSchema, score };
}).sort((a, b) => b.score - a.score);

console.log('=== TOP 5 (Best Scores) ===');
scored.slice(0, 5).forEach(t => {
  console.log(`${t.type}: ${t.score}% | HTML=${t.htmlLen} chars, Styles=${t.styleCount} rules, Schema=${t.hasSchema}`);
});

console.log('\n=== BOTTOM 5 (Worst Scores) ===');
scored.slice(-5).forEach(t => {
  console.log(`${t.type}: ${t.score}% | HTML=${t.htmlLen} chars, Styles=${t.styleCount} rules, Schema=${t.hasSchema}`);
});

console.log('\n=== GAP ANALYSIS ===');
const maxHtml = Math.max(...scored.map(s => s.htmlLen));
const maxStyles = Math.max(...scored.map(s => s.styleCount));
console.log(`Best HTML length: ${maxHtml} chars (need 400+ for full points)`);
console.log(`Best style count: ${maxStyles} rules (need 10+ for full points)`);
console.log(`Templates with schema: ${scored.filter(s => s.hasSchema).length}/37`);

console.log('\n=== WHAT EACH COMPONENT CONTRIBUTES ===');
console.log('Component        | Max Points | How to Earn');
console.log('-----------------|------------|------------------');
console.log('HTML Length      | 50 pts     | 400+ characters');
console.log('CSS Rules        | 30 pts     | 10+ style rules');
console.log('Schema.org       | 20 pts     | Has @context/@type');
console.log('-----------------|------------|------------------');
console.log('TOTAL            | 100 pts    |');

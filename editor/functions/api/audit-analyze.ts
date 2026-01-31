/**
 * /api/audit-analyze — AI interpretation of audit results
 *
 * POST /api/audit-analyze
 * Body: { auditData: object, html: string }
 *
 * Uses Claude Haiku 4.5 to provide actionable recommendations
 * based on the audit scores and page content.
 */

interface Env {
  ANTHROPIC_API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: { auditData: any; html: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { auditData, html } = body;
  if (!auditData || !html) {
    return Response.json({ ok: false, error: 'Missing auditData or html' }, { status: 400 });
  }

  const report = auditData.generate_overall_report || auditData;
  const scores = report.scores || {};

  // Build a summary of the audit for the LLM
  const auditSummary = `
Page Audit Results:
- Overall Score: ${scores.overall || 'N/A'}/100 (${scores.grades?.overall || 'N/A'})
- Schema Score: ${scores.schema || 'N/A'}/100
- LLM Readability: ${scores.llmReadability || 'N/A'}/100
- Semantics Score: ${scores.semantics || 'N/A'}/100

Top Issues Identified:
${(report.topIssues || []).map((i: any) => `- ${i.issue || i.action}: ${i.fix || i.impact || ''}`).join('\n') || 'None'}

Quick Wins Suggested:
${(report.quickWins || []).map((w: any) => `- ${w.action}: ${w.implementation || ''}`).join('\n') || 'None'}
`.trim();

  // Truncate HTML to avoid token limits (keep first 8000 chars)
  const truncatedHtml = html.length > 8000 ? html.substring(0, 8000) + '\n<!-- truncated -->' : html;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a web SEO and accessibility expert. Analyze this page audit and provide 3-5 specific, actionable improvements the user should make.

${auditSummary}

HTML Preview (may be truncated):
\`\`\`html
${truncatedHtml}
\`\`\`

Provide your analysis in this exact JSON format:
{
  "verdict": "One sentence overall assessment",
  "improvements": [
    {
      "priority": "high|medium|low",
      "category": "schema|accessibility|seo|content",
      "title": "Short title",
      "description": "What to do and why",
      "example": "Code example or specific text to add (optional)"
    }
  ],
  "strengths": ["What the page does well (1-2 items)"]
}

Focus on practical improvements. Be specific - reference actual elements from the HTML when possible. Keep descriptions under 100 words each.`
        }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return Response.json({ ok: false, error: 'AI analysis failed' }, { status: 502 });
    }

    const result = await response.json() as any;
    const textContent = result.content?.find((c: any) => c.type === 'text')?.text || '';

    // Parse the JSON from Claude's response
    let analysis;
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      // If parsing fails, return the raw text
      return Response.json({
        ok: true,
        analysis: {
          verdict: textContent.substring(0, 200),
          improvements: [],
          strengths: [],
          raw: textContent,
        },
      });
    }

    return Response.json({ ok: true, analysis });
  } catch (err: any) {
    console.error('Analysis error:', err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

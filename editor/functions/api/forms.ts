/**
 * POST /api/forms — Handle form submissions
 *
 * Routes form data to configured action (email, webhook, database)
 * based on the action configuration stored with the form component.
 */

import {
  type ActionConfig,
  type ActionType,
  validateForm,
  replaceTemplateVariables,
  buildEmailBody,
} from '../../lib/action-components';

interface Env {
  BLOXX_SITES: R2Bucket;
  XANO_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  RESEND_API_KEY?: string;
  FORM_SUBMISSIONS?: KVNamespace; // For rate limiting
}

interface FormSubmission {
  siteId: string;
  formId: string;
  actionConfig: ActionConfig;
  formData: Record<string, any>;
  pageUrl?: string;
  globalSettings?: Record<string, any>;
}

interface SubmissionResult {
  success: boolean;
  message?: string;
  redirectUrl?: string;
  errors?: Record<string, string>;
}

/**
 * Rate limiting check
 */
async function checkRateLimit(
  kv: KVNamespace | undefined,
  siteId: string,
  formId: string,
  ip: string,
  config: ActionConfig
): Promise<{ allowed: boolean; message?: string }> {
  if (!kv || !config.rateLimit) {
    return { allowed: true };
  }

  const key = `rate:${siteId}:${formId}:${ip}`;
  const windowMs = config.rateLimit.windowMinutes * 60 * 1000;

  const existing = await kv.get(key, 'json') as { count: number; firstSubmit: number } | null;

  if (!existing) {
    await kv.put(key, JSON.stringify({ count: 1, firstSubmit: Date.now() }), {
      expirationTtl: config.rateLimit.windowMinutes * 60,
    });
    return { allowed: true };
  }

  // Check if window has expired
  if (Date.now() - existing.firstSubmit > windowMs) {
    await kv.put(key, JSON.stringify({ count: 1, firstSubmit: Date.now() }), {
      expirationTtl: config.rateLimit.windowMinutes * 60,
    });
    return { allowed: true };
  }

  // Check count
  if (existing.count >= config.rateLimit.maxSubmissions) {
    return {
      allowed: false,
      message: `Too many submissions. Please try again in ${config.rateLimit.windowMinutes} minutes.`,
    };
  }

  // Increment count
  await kv.put(key, JSON.stringify({ count: existing.count + 1, firstSubmit: existing.firstSubmit }), {
    expirationTtl: config.rateLimit.windowMinutes * 60,
  });

  return { allowed: true };
}

/**
 * Honeypot check
 */
function checkHoneypot(formData: Record<string, any>, config: ActionConfig): boolean {
  if (!config.honeypot?.enabled) return true;

  const honeypotField = config.honeypot.fieldName || '_hp';
  return !formData[honeypotField] || formData[honeypotField] === '';
}

/**
 * Send email via SendGrid
 */
async function sendEmailSendGrid(
  apiKey: string,
  to: string,
  from: string,
  subject: string,
  body: string,
  replyTo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        reply_to: replyTo ? { email: replyTo } : undefined,
        subject,
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Send email via Resend
 */
async function sendEmailResend(
  apiKey: string,
  to: string,
  from: string,
  subject: string,
  body: string,
  replyTo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyTo,
        subject,
        text: body,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Handle email action
 */
async function handleEmailAction(
  env: Env,
  config: ActionConfig,
  formData: Record<string, any>,
  globalSettings?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const emailConfig = config.emailConfig;
  if (!emailConfig) {
    return { success: false, error: 'Email config missing' };
  }

  const to = replaceTemplateVariables(emailConfig.to, formData, globalSettings);
  const subject = replaceTemplateVariables(emailConfig.subject, formData, globalSettings);
  const replyTo = emailConfig.replyTo
    ? replaceTemplateVariables(emailConfig.replyTo, formData, globalSettings)
    : undefined;

  const body = buildEmailBody(formData);

  // Determine email provider
  const provider = globalSettings?.integrations?.emailProvider || 'sendgrid';
  const fromEmail = globalSettings?.integrations?.emailFromAddress || 'noreply@bloxx.site';

  if (provider === 'resend' && env.RESEND_API_KEY) {
    return sendEmailResend(env.RESEND_API_KEY, to, fromEmail, subject, body, replyTo);
  }

  if (env.SENDGRID_API_KEY) {
    return sendEmailSendGrid(env.SENDGRID_API_KEY, to, fromEmail, subject, body, replyTo);
  }

  return { success: false, error: 'No email provider configured' };
}

/**
 * Handle webhook action
 */
async function handleWebhookAction(
  config: ActionConfig,
  formData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const webhookConfig = config.webhookConfig;
  if (!webhookConfig?.url) {
    return { success: false, error: 'Webhook URL missing' };
  }

  // Filter fields if not '*'
  let payload = formData;
  if (webhookConfig.includeFields !== '*') {
    payload = {};
    for (const field of webhookConfig.includeFields) {
      if (formData[field] !== undefined) {
        payload[field] = formData[field];
      }
    }
  }

  // Remove internal fields
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !key.startsWith('_'))
  );

  try {
    const response = await fetch(webhookConfig.url, {
      method: webhookConfig.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...webhookConfig.headers,
      },
      body: JSON.stringify(cleanPayload),
    });

    if (!response.ok) {
      return { success: false, error: `Webhook returned ${response.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Handle database action (via Xano)
 */
async function handleDatabaseAction(
  env: Env,
  config: ActionConfig,
  formData: Record<string, any>,
  globalSettings?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const dbConfig = config.databaseConfig;
  if (!dbConfig?.table) {
    return { success: false, error: 'Database table not configured' };
  }

  if (!env.XANO_API_KEY) {
    return { success: false, error: 'Database not configured' };
  }

  // Build record from mappings
  const record: Record<string, any> = {};
  for (const [column, template] of Object.entries(dbConfig.mappings)) {
    record[column] = replaceTemplateVariables(template, formData, globalSettings);
  }

  // Add metadata
  record._submitted_at = new Date().toISOString();

  try {
    // Use Xano API to insert record
    const xanoUrl = `https://xyfa-9qn6-4vhk.n7.xano.io/api:la4i98J3/${dbConfig.table}`;
    const response = await fetch(xanoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.XANO_API_KEY}`,
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Handle Zapier action
 */
async function handleZapierAction(
  config: ActionConfig,
  formData: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const zapierConfig = config.zapierConfig;
  if (!zapierConfig?.webhookUrl) {
    return { success: false, error: 'Zapier webhook URL missing' };
  }

  // Filter fields if not '*'
  let payload = formData;
  if (zapierConfig.includeFields !== '*') {
    payload = {};
    for (const field of zapierConfig.includeFields) {
      if (formData[field] !== undefined) {
        payload[field] = formData[field];
      }
    }
  }

  try {
    const response = await fetch(zapierConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { success: false, error: `Zapier webhook returned ${response.status}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Process form submission based on action type
 */
async function processSubmission(
  env: Env,
  actionConfig: ActionConfig,
  formData: Record<string, any>,
  globalSettings?: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  switch (actionConfig.action) {
    case 'email':
      return handleEmailAction(env, actionConfig, formData, globalSettings);
    case 'webhook':
      return handleWebhookAction(actionConfig, formData);
    case 'database':
      return handleDatabaseAction(env, actionConfig, formData, globalSettings);
    case 'zapier':
      return handleZapierAction(actionConfig, formData);
    default:
      return { success: false, error: `Unknown action type: ${actionConfig.action}` };
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // Get client IP for rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  let body: FormSubmission;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: 'Invalid request' }, { status: 400 });
  }

  const { siteId, formId, actionConfig, formData, pageUrl, globalSettings } = body;

  if (!siteId || !formId || !actionConfig || !formData) {
    return Response.json({ success: false, message: 'Missing required fields' }, { status: 400 });
  }

  // Honeypot check
  if (!checkHoneypot(formData, actionConfig)) {
    // Silently reject spam
    return Response.json({
      success: true,
      message: actionConfig.onSuccess?.message || 'Thank you for your submission!',
    });
  }

  // Rate limiting
  const rateCheck = await checkRateLimit(env.FORM_SUBMISSIONS, siteId, formId, clientIP, actionConfig);
  if (!rateCheck.allowed) {
    return Response.json({ success: false, message: rateCheck.message }, { status: 429 });
  }

  // Validation
  if (actionConfig.validation) {
    const errors = validateForm(formData, actionConfig.validation);
    if (Object.keys(errors).length > 0) {
      return Response.json({ success: false, errors, message: 'Validation failed' }, { status: 400 });
    }
  }

  // Add page URL to form data for context
  const enrichedFormData = {
    ...formData,
    _pageUrl: pageUrl,
    _submittedAt: new Date().toISOString(),
  };

  // Process the submission
  const result = await processSubmission(env, actionConfig, enrichedFormData, globalSettings);

  if (!result.success) {
    console.error('Form submission failed:', result.error);
    return Response.json({
      success: false,
      message: actionConfig.onError?.message || 'Something went wrong. Please try again.',
    }, { status: 500 });
  }

  // Success response
  const response: SubmissionResult = {
    success: true,
    message: actionConfig.onSuccess?.message,
    redirectUrl: actionConfig.onSuccess?.type === 'redirect' ? actionConfig.onSuccess.redirectUrl : undefined,
  };

  return Response.json(response);
};

/**
 * GET /api/forms/submissions — List form submissions (admin)
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;
  const url = new URL(context.request.url);
  const siteId = url.searchParams.get('site');
  const table = url.searchParams.get('table') || 'form_submissions';

  if (!siteId) {
    return Response.json({ ok: false, error: 'Missing site parameter' }, { status: 400 });
  }

  if (!env.XANO_API_KEY) {
    return Response.json({ ok: false, error: 'Database not configured' }, { status: 500 });
  }

  try {
    const xanoUrl = `https://xyfa-9qn6-4vhk.n7.xano.io/api:la4i98J3/${table}?site_id=${siteId}`;
    const response = await fetch(xanoUrl, {
      headers: {
        'Authorization': `Bearer ${env.XANO_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Xano API error: ${response.status}`);
    }

    const submissions = await response.json();
    return Response.json({ ok: true, submissions });
  } catch (err: any) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

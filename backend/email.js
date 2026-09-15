'use strict';

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

function isEmailConfigured() {
  const smtpPassword = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return Boolean(
    (process.env.EMAILJS_SERVICE_ID &&
      process.env.EMAILJS_TEMPLATE_ID &&
      process.env.EMAILJS_PUBLIC_KEY) ||
    process.env.RESEND_API_KEY ||
    (nodemailer &&
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      smtpPassword)
  );
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

const FULL_ACTION_PLAN_TITLE = 'Full Action Plan — All Priority 1-3 Recommendations';
const FULL_ACTION_PLAN = [
  {
    priority: 'Priority 1 — Immediate action',
    title: 'Increase workforce in Zone B',
    detail: 'Drainage crew is running 34% below the staffing plan for this stage. Additional labor directly targets the bottleneck.',
    impact: 'Expected recovery: approximately 2 days.'
  },
  {
    priority: 'Priority 2 — Schedule recovery',
    title: 'Reallocate excavator from Zone D',
    detail: 'Zone D is ahead of schedule and can release equipment without risk to its own timeline.',
    impact: 'Expected improvement: approximately 14% productivity.'
  },
  {
    priority: 'Priority 3 — Prevent downstream delay',
    title: 'Prioritize material delivery, Segment 07',
    detail: 'Aggregate delivery is trending two days behind consumption rate, which risks stalling Road Base downstream.',
    impact: 'Expected result: reduced downstream schedule risk.'
  }
];

async function sendActionEmail({ managerName, managerEmail, priority, remarks, recTitle }) {
  if (!isEmailConfigured()) throw new Error('Email delivery is not configured.');

  // Google displays App Passwords in groups for readability. SMTP expects the
  // 16-character value without those spaces, so normalize pasted credentials.
  const smtpPassword = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: smtpPassword },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });

  const isFullActionPlan = recTitle === FULL_ACTION_PLAN_TITLE;
  const recommendationHtml = isFullActionPlan
    ? `<h3 style="margin:24px 0 12px">Complete recommended action plan</h3>
       ${FULL_ACTION_PLAN.map(item => `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;margin:12px 0">
         <div style="font-size:11px;color:#2563eb;font-weight:bold">${escapeHtml(item.priority)}</div>
         <h3 style="margin:6px 0">${escapeHtml(item.title)}</h3>
         <p style="margin:6px 0">${escapeHtml(item.detail)}</p>
         <p style="margin:6px 0"><b>${escapeHtml(item.impact)}</b></p>
       </div>`).join('')}`
    : `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:18px;margin:20px 0">
         <div style="font-size:11px;color:#2563eb;font-weight:bold">${escapeHtml(priority)}</div>
         <h3>${escapeHtml(recTitle)}</h3>
         ${remarks ? `<p><b>Directive remarks:</b> ${escapeHtml(remarks)}</p>` : ''}
       </div>`;
  const recommendationText = isFullActionPlan
    ? FULL_ACTION_PLAN.map(item => `${item.priority}\n${item.title}\n${item.detail}\n${item.impact}`).join('\n\n')
    : `SitePulse action plan: ${recTitle}\nPriority: ${priority}\n${remarks || ''}`;

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:20px">
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:28px">
      <h2>SitePulse — Project Directive Notification</h2>
      <p>Hello <b>${escapeHtml(managerName)}</b>,</p>
      <p>The following schedule recovery action plan was dispatched from SitePulse.</p>
      ${recommendationHtml}
      ${isFullActionPlan && remarks ? `<p><b>Manager notes:</b> ${escapeHtml(remarks)}</p>` : ''}
      <p style="font-size:12px;color:#64748b">SIH26122 · SitePulse Infrastructure Intelligence Platform</p>
    </div></body></html>`;

  // EmailJS sends through HTTPS and its Gmail connector, so it works from
  // Render Free without exposing the connected Gmail credentials to this app.
  if (process.env.EMAILJS_SERVICE_ID && process.env.EMAILJS_TEMPLATE_ID && process.env.EMAILJS_PUBLIC_KEY) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    let responseText;
    try {
      response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'sitepulse/1.0'
        },
        body: JSON.stringify({
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_TEMPLATE_ID,
          user_id: process.env.EMAILJS_PUBLIC_KEY,
          ...(process.env.EMAILJS_PRIVATE_KEY ? { accessToken: process.env.EMAILJS_PRIVATE_KEY } : {}),
          template_params: {
            manager_email: managerEmail,
            name: managerName,
            email: process.env.EMAILJS_REPLY_TO || process.env.SMTP_FROM || process.env.SMTP_USER || '',
            subject: `[${priority}] SitePulse Action Plan: ${recTitle}`,
            html
          }
        }),
        signal: controller.signal
      });
      responseText = await response.text();
    } catch (cause) {
      const error = new Error('Could not reach the EmailJS delivery API.');
      error.code = 'EEMAILJS';
      error.cause = cause;
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = new Error(responseText || 'EmailJS did not accept this email request.');
      error.code = 'EEMAILJS';
      error.statusCode = 502;
      throw error;
    }
    return { recipient: managerEmail, messageId: `emailjs-${Date.now()}`, providerResponse: responseText || 'EmailJS accepted the email.' };
  }

  // Render Free blocks outbound SMTP ports. Resend uses HTTPS, which works on
  // that plan. Keep SMTP as a fallback for local development or paid hosting.
  if (process.env.RESEND_API_KEY) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response;
    let data;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'sitepulse/1.0'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
          to: [managerEmail],
          subject: `[${priority}] SitePulse Action Plan: ${recTitle}`,
          text: `${recommendationText}${isFullActionPlan && remarks ? `\n\nManager notes: ${remarks}` : ''}`,
          html
        }),
        signal: controller.signal
      });
      data = await response.json().catch(() => ({}));
    } catch (cause) {
      const error = new Error('Could not reach the Resend email API.');
      error.code = 'ERESEND';
      error.cause = cause;
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || !data.id) {
      const error = new Error(data.message || 'Resend did not accept this email request.');
      error.code = 'ERESEND';
      error.statusCode = 502;
      throw error;
    }
    return { recipient: managerEmail, messageId: data.id, providerResponse: 'Resend accepted the email.' };
  }

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: managerEmail,
    subject: `[${priority}] SitePulse Action Plan: ${recTitle}`,
    text: `${recommendationText}${isFullActionPlan && remarks ? `\n\nManager notes: ${remarks}` : ''}`,
    html
  });

  // Nodemailer can resolve a send operation even when the SMTP provider rejects
  // every recipient. Do not let the browser present that as a successful email.
  const accepted = Array.isArray(info.accepted) ? info.accepted : [];
  if (!accepted.some(address => String(address).toLowerCase() === managerEmail.toLowerCase())) {
    const rejected = Array.isArray(info.rejected) && info.rejected.length
      ? info.rejected.join(', ')
      : managerEmail;
    const error = new Error(`The mail provider did not accept the recipient address: ${rejected}.`);
    error.statusCode = 502;
    throw error;
  }

  return { recipient: managerEmail, messageId: info.messageId, providerResponse: info.response };
}

module.exports = { isEmailConfigured, sendActionEmail };

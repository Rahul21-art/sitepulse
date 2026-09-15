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
    nodemailer &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    smtpPassword
  );
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

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

  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:20px">
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:28px">
      <h2>SitePulse — Project Directive Notification</h2>
      <p>Hello <b>${escapeHtml(managerName)}</b>,</p>
      <p>The following schedule recovery action plan was dispatched from SitePulse.</p>
      <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:18px;margin:20px 0">
        <div style="font-size:11px;color:#2563eb;font-weight:bold">${escapeHtml(priority)}</div>
        <h3>${escapeHtml(recTitle)}</h3>
        ${remarks ? `<p><b>Directive remarks:</b> ${escapeHtml(remarks)}</p>` : ''}
      </div>
      <p style="font-size:12px;color:#64748b">SIH26122 · SitePulse Infrastructure Intelligence Platform</p>
    </div></body></html>`;

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: managerEmail,
    subject: `[${priority}] SitePulse Action Plan: ${recTitle}`,
    text: `SitePulse action plan: ${recTitle}\nPriority: ${priority}\n${remarks || ''}`,
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

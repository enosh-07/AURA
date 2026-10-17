/**
 * AURA Transactional Email Service — Powered by Resend
 *
 * Handles:
 * 1. Welcome emails upon user registration
 * 2. Password recovery emails & security notices
 * 3. Application notifications (playlist invites, listening insights)
 *
 * Security:
 * - RESEND_API_KEY is server-side only
 * - Email addresses validated prior to dispatch
 * - Never logs tokens, passwords, or secrets
 * - Graceful fallback to simulated delivery when RESEND_API_KEY is not configured
 */

import { Resend } from 'resend';
import { ENV } from '../config/env.js';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

class EmailService {
  private resend: Resend | null = null;
  public readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = Boolean(
      ENV.RESEND_API_KEY &&
      !ENV.RESEND_API_KEY.includes('your_resend_api_key')
    );

    if (this.isConfigured) {
      this.resend = new Resend(ENV.RESEND_API_KEY);
    }
  }

  /**
   * Validates standard email address syntax
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Generates AURA's dark-mode branded HTML email wrapper
   */
  private renderEmailTemplate(heading: string, bodyHtml: string, cta?: { text: string; url: string }): string {
    const ctaButton = cta
      ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
          <tr>
            <td align="center">
              <a href="${cta.url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%); color: #0a0908; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 12px; letter-spacing: 0.5px;">
                ${cta.text}
              </a>
            </td>
          </tr>
        </table>
      `
      : '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${heading}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0a0908; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4eee8;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0a0908; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #121110; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);">
                  <!-- Header / Logo -->
                  <tr>
                    <td style="padding: 36px 40px 20px; text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                      <div style="display: inline-flex; align-items: center; gap: 8px;">
                        <span style="font-size: 24px; font-weight: 900; letter-spacing: 2px; color: #00f2fe; text-transform: uppercase;">AURA</span>
                        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #00f2fe; margin-bottom: 6px;"></span>
                      </div>
                      <p style="margin: 4px 0 0; font-size: 11px; font-family: monospace; text-transform: uppercase; letter-spacing: 1.5px; color: rgba(255, 255, 255, 0.4);">High-Fidelity AI Music Engine</p>
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 36px 40px;">
                      <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.3;">
                        ${heading}
                      </h1>
                      <div style="font-size: 14px; line-height: 1.6; color: rgba(244, 238, 232, 0.8);">
                        ${bodyHtml}
                      </div>
                      ${ctaButton}
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 40px; background-color: #0c0b0a; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; font-size: 11px; color: rgba(255, 255, 255, 0.35);">
                      <p style="margin: 0 0 8px;">AURA Music Platform • Genuine Lossless 24-bit Hi-Res Streaming</p>
                      <p style="margin: 0;">If you did not initiate this request, you can safely ignore this email.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
  }

  /**
   * Dispatches a branded Welcome Email to a newly registered user
   */
  async sendWelcomeEmail(toEmail: string, userName: string): Promise<EmailSendResult> {
    if (!this.isValidEmail(toEmail)) {
      return { success: false, error: 'Invalid recipient email address format.' };
    }

    const heading = `Welcome to AURA, ${userName}`;
    const bodyHtml = `
      <p>Your high-fidelity journey begins now. AURA is engineered for pure acoustic clarity, genuine lossless playback, and intelligent musical discovery.</p>
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0 0 8px; font-weight: 700; color: #00f2fe;">✨ What to explore first:</p>
        <ul style="margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.7); font-size: 13px;">
          <li><strong>Acoustic Lab:</strong> Fine-tune your sound with our studio-grade 10-band ISO equalizer.</li>
          <li><strong>Real-Time Visualizers:</strong> 60fps frequency bars, circular spectrums, and quantum particle fields.</li>
          <li><strong>Social Listening Rooms:</strong> Listen in sync with friends with zero latency drift.</li>
          <li><strong>AURA AI DJ:</strong> Ask for playlist curation or harmonic transitions powered by Gemini.</li>
        </ul>
      </div>
      <p>Start streaming now and experience your music without compression compromises.</p>
    `;

    const appUrl = ENV.CLIENT_URL || 'https://aura.audio';

    if (!this.isConfigured || !this.resend) {
      console.log(`[EmailService:Simulated] Welcome email dispatched to ${toEmail}`);
      return { success: true, simulated: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: ENV.RESEND_FROM_EMAIL,
        to: toEmail,
        subject: 'Welcome to AURA — Pure Lossless Audio & AI Intelligence',
        html: this.renderEmailTemplate(heading, bodyHtml, { text: 'Launch AURA Player', url: appUrl }),
      });

      if (error) {
        console.error('[EmailService] Resend dispatch error:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err: any) {
      console.error('[EmailService] Resend dispatch failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispatches a Password Reset Email
   * (Used when triggering resets outside Supabase Auth's native SMTP gateway)
   */
  async sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<EmailSendResult> {
    if (!this.isValidEmail(toEmail)) {
      return { success: false, error: 'Invalid recipient email address format.' };
    }

    const heading = 'Reset Your AURA Password';
    const bodyHtml = `
      <p>We received a request to reset the password associated with your AURA account.</p>
      <p>Click the button below to establish a new password. For security, this link expires in <strong>60 minutes</strong>.</p>
      <div style="background: rgba(255, 160, 0, 0.08); border: 1px solid rgba(255, 160, 0, 0.2); border-radius: 10px; padding: 12px; margin: 16px 0; font-size: 12px; color: #ffb74d;">
        🔒 If you did not request a password reset, please ignore this notice. Your password will remain unchanged.
      </div>
    `;

    if (!this.isConfigured || !this.resend) {
      console.log(`[EmailService:Simulated] Password reset dispatched to ${toEmail}`);
      return { success: true, simulated: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: ENV.RESEND_FROM_EMAIL,
        to: toEmail,
        subject: 'AURA Account Security: Password Reset Request',
        html: this.renderEmailTemplate(heading, bodyHtml, { text: 'Reset Password', url: resetLink }),
      });

      if (error) {
        console.error('[EmailService] Password reset email error:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err: any) {
      console.error('[EmailService] Password reset email failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispatches general application notification emails (playlist invites, weekly insight digest)
   */
  async sendNotificationEmail(
    toEmail: string,
    subject: string,
    heading: string,
    messageHtml: string,
    cta?: { text: string; url: string }
  ): Promise<EmailSendResult> {
    if (!this.isValidEmail(toEmail)) {
      return { success: false, error: 'Invalid recipient email format.' };
    }

    if (!this.isConfigured || !this.resend) {
      console.log(`[EmailService:Simulated] Notification dispatched to ${toEmail}: "${subject}"`);
      return { success: true, simulated: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: ENV.RESEND_FROM_EMAIL,
        to: toEmail,
        subject,
        html: this.renderEmailTemplate(heading, messageHtml, cta),
      });

      if (error) {
        console.error('[EmailService] Notification dispatch error:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.id };
    } catch (err: any) {
      console.error('[EmailService] Notification dispatch failed:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export const emailService = new EmailService();

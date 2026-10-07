import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

class MailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: config.SMTP_EMAIL,
          pass: config.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false, // Prevents self-signed cert issues
        },
      });

      logger.info(`[MailService] Initialized with SMTP Host: ${config.SMTP_HOST}:${config.SMTP_PORT}`);
    } catch (err: any) {
      logger.error(`[MailService] Initialization error: ${err.message}`);
    }
  }

  async sendPasswordResetOTP(toEmail: string, recipientName: string, otp: string): Promise<boolean> {
    const subject = `Your Password Reset Verification Code - ${config.FROM_NAME}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #0B1E1F; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Saamaan COMMERCE</h1>
          <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">Security Notification</p>
        </div>
        <div style="padding: 36px 32px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Password Reset Request</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">Hello ${recipientName || 'Valued Customer'},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">We received a request to reset your password for your Saamaan Customer Account. Use the one-time verification code below to authorize this request:</p>
          
          <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
            <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">${otp}</span>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">This code is valid for <strong>15 minutes</strong>.</p>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #64748b;">If you did not request this password reset, please ignore this email or reach out to our Customer Support team immediately. Your account remains completely secure.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Saamaan Commerce. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: toEmail,
        subject,
        html,
      });
      logger.info(`[MailService] Sent password reset OTP to ${toEmail}`);
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to send email to ${toEmail}: ${err.message}`);
      // Return false but don't crash caller
      return false;
    }
  }

  async sendWelcomeEmail(toEmail: string, recipientName: string): Promise<boolean> {
    const subject = `Welcome to Saamaan - Your Account is Ready`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background-color: #0B1E1F; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Saamaan COMMERCE</h1>
        </div>
        <div style="padding: 36px 32px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Welcome, ${recipientName}!</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">Thank you for registering your customer account with Saamaan. You now have access to member-only curation, priority order tracking, and seamless checkout.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Saamaan Commerce. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: toEmail,
        subject,
        html,
      });
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to send welcome email to ${toEmail}: ${err.message}`);
      return false;
    }
  }

  async sendInquiryToSupport(params: {
    recipientEmail: string;
    referenceId: string;
    senderName: string;
    senderEmail: string;
    subject?: string;
    message: string;
  }): Promise<boolean> {
    const subject = `[Inquiry #${params.referenceId}] ${params.subject || 'Customer Support Request'}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #0B1E1F; padding: 24px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">Saamaan COMMERCE</h1>
          <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">Customer Support Ticket System</p>
        </div>
        <div style="padding: 32px; color: #1e293b;">
          <div style="background: #f1f5f9; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
            <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600;">REFERENCE TICKET ID</p>
            <p style="margin: 2px 0 0 0; font-size: 18px; color: #0f172a; font-weight: 800; font-family: monospace;">${params.referenceId}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 130px; font-weight: 600;">Customer Name:</td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 700;">${params.senderName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Customer Email:</td>
              <td style="padding: 8px 0; color: #4f46e5; font-weight: 600;"><a href="mailto:${params.senderEmail}" style="color: #4f46e5; text-decoration: none;">${params.senderEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Subject / Topic:</td>
              <td style="padding: 8px 0; color: #0f172a;">${params.subject || 'General Inquiry'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Received At:</td>
              <td style="padding: 8px 0; color: #0f172a;">${new Date().toLocaleString('en-US', { timeZoneName: 'short' })}</td>
            </tr>
          </table>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
            <p style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700;">Inquiry Message:</p>
            <div style="font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${params.message}</div>
          </div>

          <p style="margin-top: 24px; font-size: 12px; color: #64748b; line-height: 1.5;">
            💡 <em>You can reply directly to this email to respond to <strong>${params.senderName}</strong> at <strong>${params.senderEmail}</strong>.</em>
          </p>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8;">
          <p style="margin: 0;">Internal Notification • Saamaan Commerce Platform</p>
        </div>
      </div>
    `;

    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: params.recipientEmail,
        replyTo: params.senderEmail,
        subject,
        html,
      });
      logger.info(`[MailService] Dispatched inquiry #${params.referenceId} to support desk (${params.recipientEmail}) with reply-to ${params.senderEmail}`);
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to dispatch inquiry to support desk: ${err.message}`);
      return false;
    }
  }

  async sendInquiryReceiptToCustomer(params: {
    customerEmail: string;
    customerName: string;
    referenceId: string;
    subject?: string;
  }): Promise<boolean> {
    const subject = `Inquiry Received [${params.referenceId}] - Saamaan Support`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #0B1E1F; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Saamaan COMMERCE</h1>
          <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">Customer Concierge Desk</p>
        </div>
        <div style="padding: 32px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Thank You for Reaching Out</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">Hello ${params.customerName || 'Valued Customer'},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">We have received your message regarding <strong>${params.subject || 'your inquiry'}</strong>. A dedicated customer support specialist has been assigned to assist you.</p>

          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 16px 20px; margin: 24px 0;">
            <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700;">YOUR REFERENCE TICKET</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #4f46e5; font-family: monospace;">${params.referenceId}</p>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748b;">Typical response time: <strong>2 – 4 business hours</strong>.</p>
          </div>

          <p style="font-size: 13px; line-height: 1.6; color: #64748b;">If you have any urgent attachments or updates, you can reply directly to this email quoting your reference ticket ID.</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Saamaan Commerce. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: params.customerEmail,
        subject,
        html,
      });
      logger.info(`[MailService] Sent confirmation receipt #${params.referenceId} to customer ${params.customerEmail}`);
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to send receipt to customer: ${err.message}`);
      return false;
    }
  }

  async sendTestEmail(toEmail: string): Promise<boolean> {
    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: toEmail,
        subject: `[Test] Email Service Configuration Check - ${config.FROM_NAME}`,
        html: `<p>This is a test email confirming your email service configuration is operational.</p>`,
      });
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to send test email: ${err.message}`);
      return false;
    }
  }

  async sendPasswordChangedNotification(toEmail: string, recipientName: string): Promise<boolean> {
    const subject = `Security Alert: Your Password Was Changed`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background-color: #0B1E1F; padding: 28px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">SAAMAN</h1>
          <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">Security Alert</p>
        </div>
        <div style="padding: 36px 32px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Password Successfully Changed</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">Hello ${recipientName || 'User'},</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">The password for your account has just been successfully updated. All other active sessions have been invalidated for your security.</p>
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #991b1b; font-weight: 600;">
              If you did not make this change, please contact support or your system administrator immediately to secure your account.
            </p>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">© ${new Date().getFullYear()} Saaman Commerce. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: toEmail,
        subject,
        html,
      });
      logger.info(`[MailService] Sent password change alert to ${toEmail}`);
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to send password change alert to ${toEmail}: ${err.message}`);
      return false;
    }
  }

  async sendWarehouseInvitation(params: {
    toEmail: string;
    warehouseName: string;
    warehouseCode: string;
    sellerName: string;
    inviteUrl: string;
    expiresInHours: number;
    userExists: boolean;
  }): Promise<boolean> {
    const subject = `Invitation to join ${params.warehouseName} - Saamaan`;
    const actionText = params.userExists
      ? 'Sign In & Accept Invitation'
      : 'Create Account & Join Warehouse';

    const accountNotice = params.userExists
      ? `<p style="font-size: 13px; line-height: 1.6; color: #1e293b; background: #f0fdf4; border-left: 3px solid #16a34a; padding: 12px 14px; border-radius: 6px; margin: 16px 0;">
           <strong>Existing Account:</strong> You already have a Saamaan account under this email. Simply sign in with your password to accept this invitation.
         </p>`
      : `<p style="font-size: 13px; line-height: 1.6; color: #1e293b; background: #eff6ff; border-left: 3px solid #2563eb; padding: 12px 14px; border-radius: 6px; margin: 16px 0;">
           <strong>New Account:</strong> Click below to create your password and set up your warehouse account.
         </p>`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
        <div style="background-color: #0B1E1F; padding: 24px 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">SAAMAAN</h1>
          <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">Warehouse Portal</p>
        </div>
        <div style="padding: 32px; color: #1e293b;">
          <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px;">
            Warehouse Team Invitation
          </h2>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-top: 0;">
            <strong>${params.sellerName}</strong> has invited you to join the team for the following warehouse:
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 18px 0;">
            <div style="font-size: 16px; font-weight: 700; color: #0f172a;">${params.warehouseName}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Warehouse Code: <span style="font-family: monospace; font-weight: 600; color: #0f172a;">${params.warehouseCode}</span></div>
          </div>

          ${accountNotice}

          <div style="text-align: center; margin: 28px 0;">
            <a href="${params.inviteUrl}" style="background-color: #0C6E7E; color: #ffffff; padding: 12px 26px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 10px; display: inline-block;">
              ${actionText} &rarr;
            </a>
          </div>

          <p style="font-size: 12px; color: #64748b; text-align: center; margin-bottom: 8px;">
            This invitation link is valid for <strong>${params.expiresInHours} hours</strong>.
          </p>

          <div style="border-top: 1px dashed #e2e8f0; margin-top: 20px; padding-top: 14px;">
            <p style="font-size: 11px; color: #94a3b8; word-break: break-all; margin: 0;">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${params.inviteUrl}" style="color: #0C6E7E;">${params.inviteUrl}</a>
            </p>
          </div>
        </div>
        <div style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Saamaan Commerce. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      if (!this.transporter) this.init();
      await this.transporter?.sendMail({
        from: `"${config.FROM_NAME}" <${config.FROM_EMAIL}>`,
        to: params.toEmail,
        subject,
        html,
      });
      logger.info(`[MailService] Sent warehouse invite to ${params.toEmail} for facility ${params.warehouseCode}`);
      return true;
    } catch (err: any) {
      logger.error(`[MailService] Failed to send warehouse invite to ${params.toEmail}: ${err.message}`);
      return false;
    }
  }
}

export const mailService = new MailService();

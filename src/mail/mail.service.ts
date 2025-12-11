import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);
	private transporter: Transporter;

	constructor(private readonly configService: ConfigService) {
		this.initializeTransporter();
	}

	private initializeTransporter() {
		const host = this.configService.get<string>('MAIL_HOST');
		const port = this.configService.get<number>('MAIL_PORT');
		const user = this.configService.get<string>('MAIL_USER');
		const pass = this.configService.get<string>('MAIL_PASSWORD');
		const from = this.configService.get<string>('MAIL_FROM');

		if (!host || !port || !user || !pass) {
			this.logger.warn(
				'Mail configuration incomplete. Email functionality disabled.',
			);
			return;
		}

		this.transporter = nodemailer.createTransport({
			host,
			port,
			secure: port === 465,
			auth: { user, pass },
			from,
		});

		this.logger.log('Mail service initialized successfully');
	}

	async sendOtpEmail(
		email: string,
		otp: string,
		name: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.error(
				'Mail transporter not initialized - check env vars',
			);
			return;
		}

		const subject = 'Verify Your Email - Ad Matrix';
		const html = this.generateOtpEmailTemplate(name, otp);

		try {
			await this.transporter.sendMail({
				to: email,
				subject,
				html,
			});
			this.logger.log(`✓ OTP email sent successfully to ${email}`);
		} catch (error) {
			this.logger.error(`✗ Failed to send OTP to ${email}:`, error);
			throw error;
		}
	}

	async sendWelcomeEmail(
		email: string,
		name: string,
		autoLoginToken: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
			);
			return;
		}

		const subject = 'Welcome to Ad Matrix! 🎉';
		const html = this.generateWelcomeEmailTemplate(name, autoLoginToken);

		try {
			await this.transporter.sendMail({
				to: email,
				subject,
				html,
			});
			this.logger.log(`Welcome email sent successfully to ${email}`);
		} catch (error) {
			this.logger.error(
				`Failed to send welcome email to ${email}:`,
				error,
			);
			throw error;
		}
	}

	async sendViewerWelcomeEmail(
		email: string,
		name: string,
		autoLoginToken: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
			);
			return;
		}

		const subject = 'Welcome to Ad Matrix! 🎉';
		const html = this.generateViewerWelcomeEmailTemplate(
			name,
			autoLoginToken,
		);

		try {
			await this.transporter.sendMail({
				to: email,
				subject,
				html,
			});
			this.logger.log(
				`Viewer welcome email sent successfully to ${email}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send viewer welcome email to ${email}:`,
				error,
			);
			throw error;
		}
	}

	async sendViewerInvitation(
		email: string,
		inviterName: string,
		storeName: string,
		invitationToken: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.error('Mail transporter not initialized');
			return;
		}

		const frontendUrl =
			this.configService.get<string>('FRONTEND_URL') || '';
		const invitationUrl = `${frontendUrl}/auth/accept-invitation?token=${encodeURIComponent(invitationToken)}`;

		const subject = `You've been invited to Ad Matrix by ${inviterName}`;
		const html = this.generateInvitationEmailTemplate(
			inviterName,
			storeName,
			invitationUrl,
		);

		try {
			await this.transporter.sendMail({ to: email, subject, html });
			this.logger.log(`✓ Invitation email sent to ${email}`);
		} catch (error) {
			this.logger.error(
				`✗ Failed to send invitation to ${email}:`,
				error,
			);
			throw error;
		}
	}

	async sendStoreAssignmentNotification(
		email: string,
		viewerName: string,
		managerName: string,
		storeNames: string[],
	): Promise<void> {
		if (!this.transporter) {
			this.logger.error('Mail transporter not initialized');
			return;
		}

		const subject = `New Store Access Granted - Ad Matrix`;
		const html = this.generateStoreAssignmentTemplate(
			viewerName,
			managerName,
			storeNames,
		);

		try {
			await this.transporter.sendMail({ to: email, subject, html });
			this.logger.log(`✓ Store assignment notification sent to ${email}`);
		} catch (error) {
			this.logger.error(
				`✗ Failed to send assignment notification to ${email}:`,
				error,
			);
			throw error;
		}
	}

	async sendPasswordResetOtpEmail(
		email: string,
		otp: string,
		name: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.error(
				'Mail transporter not initialized - check env vars',
			);
			return;
		}

		const subject = 'Reset Your Password - Ad Matrix';
		const html = this.generatePasswordResetOtpTemplate(name, otp);

		try {
			await this.transporter.sendMail({
				to: email,
				subject,
				html,
			});
			this.logger.log(`✓ Password reset OTP sent to ${email}`);
		} catch (error) {
			this.logger.error(
				`✗ Failed to send password reset OTP to ${email}:`,
				error,
			);
			throw error;
		}
	}

	async sendPasswordResetConfirmationEmail(
		email: string,
		name: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
			);
			return;
		}

		const subject = 'Password Changed Successfully - Ad Matrix';
		const html = this.generatePasswordResetConfirmationTemplate(name);

		try {
			await this.transporter.sendMail({
				to: email,
				subject,
				html,
			});
			this.logger.log(`✓ Password reset confirmation sent to ${email}`);
		} catch (error) {
			this.logger.error(
				`✗ Failed to send password reset confirmation to ${email}:`,
				error,
			);
			throw error;
		}
	}

	async sendPasswordChangeConfirmationEmail(
		email: string,
		name: string,
	): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
			);
			return;
		}

		const subject = 'Password Changed - Ad Matrix';
		const html = this.generatePasswordChangeConfirmationTemplate(name);

		try {
			await this.transporter.sendMail({
				to: email,
				subject,
				html,
			});
			this.logger.log(`✓ Password change confirmation sent to ${email}`);
		} catch (error) {
			this.logger.error(
				`✗ Failed to send password change confirmation to ${email}:`,
				error,
			);
			throw error;
		}
	}

	private generateOtpEmailTemplate(name: string, otp: string): string {
		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background-color: #ffffff;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: #1D4ED8;
                        padding: 30px;
                        text-align: center;
                        color: #ffffff;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 600;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .greeting {
                        font-size: 18px;
                        color: #333333;
                        margin-bottom: 20px;
                    }
                    .message {
                        font-size: 16px;
                        color: #555555;
                        line-height: 1.6;
                        margin-bottom: 30px;
                    }
                    .otp-box {
                        background-color: #f8f9fa;
                        border: 2px dashed #2563EB;
                        border-radius: 8px;
                        padding: 25px;
                        text-align: center;
                        margin: 30px 0;
                    }
                    .otp-label {
                        font-size: 14px;
                        color: #666666;
                        margin-bottom: 10px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                    .otp-code {
                        font-size: 36px;
                        font-weight: bold;
                        color: #2563EB;
                        letter-spacing: 8px;
                        font-family: 'Courier New', monospace;
                    }
                    .warning {
                        background-color: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 20px 0;
                        font-size: 14px;
                        color: #856404;
                    }
                    .footer {
                        background-color: #f8f9fa;
                        padding: 20px 30px;
                        text-align: center;
                        font-size: 14px;
                        color: #666666;
                        border-top: 1px solid #e0e0e0;
                    }
                    .footer a {
                        color: #667eea;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Ad Matrix</h1>
                    </div>
                    <div class="content">
                        <div class="greeting">Hi ${name},</div>
                        <div class="message">
                            Thank you for signing up with Ad Matrix! To complete your registration and verify your email address, please use the verification code below:
                        </div>
                        <div class="otp-box">
                            <div class="otp-label">Your Verification Code</div>
                            <div class="otp-code">${otp}</div>
                        </div>
                        <div class="warning">
                            ⚠️ <strong>Important:</strong> This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.
                        </div>
                        <div class="message">
                            Once verified, you'll have full access to your Ad Matrix dashboard where you can track your store metrics, analyze performance, and optimize your advertising spend.
                        </div>
                    </div>
                    <div class="footer">
                        <p>Need help? Contact us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}

	private generateWelcomeEmailTemplate(
		name: string,
		autoLoginToken: string,
	): string {
		const frontendUrl =
			this.configService.get<string>('FRONTEND_URL') || '';
		const autoLoginUrl = `${frontendUrl}/auth/auto-login?token=${encodeURIComponent(autoLoginToken)}`;

		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background-color: #ffffff;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: #1D4ED8;
                        padding: 40px 30px;
                        text-align: center;
                        color: #ffffff;
                    }
                    .header h1 {
                        margin: 0 0 10px 0;
                        font-size: 32px;
                        font-weight: 600;
                    }
                    .header p {
                        margin: 0;
                        font-size: 16px;
                        opacity: 0.9;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .greeting {
                        font-size: 20px;
                        color: #333333;
                        margin-bottom: 20px;
                        font-weight: 600;
                    }
                    .message {
                        font-size: 16px;
                        color: #555555;
                        line-height: 1.8;
                        margin-bottom: 25px;
                    }
                    .feature-list {
                        background-color: #f8f9fa;
                        border-radius: 8px;
                        padding: 25px;
                        margin: 30px 0;
                    }
                    .feature-item {
                        display: flex;
                        align-items: flex-start;
                        margin-bottom: 15px;
                    }
                    .feature-item:last-child {
                        margin-bottom: 0;
                    }
                    .feature-icon {
                        font-size: 24px;
                        margin-right: 15px;
                        flex-shrink: 0;
                    }
                    .feature-text {
                        font-size: 15px;
                        color: #444444;
                        line-height: 1.5;
                    }
                    .feature-text strong {
                        color: #667eea;
                    }
                    .cta-button {
                        display: inline-block;
                        background: #2563EB;
                        color: #ffffff !important;
                        text-decoration: none;
                        padding: 15px 40px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 16px;
                        margin: 20px 0;
                    }
                    .cta-button:hover {
                        opacity: 0.9;
                    }
                    .auto-login-note {
                        background-color: #e7f3ff;
                        border-left: 4px solid #2196F3;
                        padding: 15px;
                        margin: 20px 0;
                        font-size: 14px;
                        color: #0d47a1;
                    }
                    .footer {
                        background-color: #f8f9fa;
                        padding: 20px 30px;
                        text-align: center;
                        font-size: 14px;
                        color: #666666;
                        border-top: 1px solid #e0e0e0;
                    }
                    .footer a {
                        color: #667eea;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Ad Matrix!</h1>
                        <p>Your account has been successfully created</p>
                    </div>
                    <div class="content">
                        <div class="greeting">Hello ${name}!</div>
                        <div class="message">
                            Congratulations! Your Ad Matrix account is now active and ready to help you optimize your advertising campaigns and track your store performance like never before.
                        </div>
                        <div class="auto-login-note">
                            🚀 <strong>Quick Start:</strong> Click the button below to access your dashboard instantly — no need to log in!
                        </div>
                        <center>
                            <a href="${autoLoginUrl}" class="cta-button">Access Your Dashboard</a>
                        </center>
                        <div class="feature-list">
                            <div class="feature-item">
                                <div class="feature-icon">📊</div>
                                <div class="feature-text">
                                    <strong>Real-time Analytics:</strong> Track your Shopify orders, revenue, and items sold in real-time
                                </div>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">💰</div>
                                <div class="feature-text">
                                    <strong>Ad Spend Tracking:</strong> Monitor your Facebook and Google ad expenditure in one unified dashboard
                                </div>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">🏆</div>
                                <div class="feature-text">
                                    <strong>Top Products:</strong> Identify your best-performing products by revenue and quantity sold
                                </div>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">📈</div>
                                <div class="feature-text">
                                    <strong>Performance Insights:</strong> Get detailed metrics to make data-driven decisions for your business
                                </div>
                            </div>
                        </div>
                        <div class="message">
                            <strong>Next Steps:</strong>
                            <ol style="padding-left: 20px; margin-top: 15px;">
                                <li style="margin-bottom: 10px;">Click the button above to access your dashboard</li>
                                <li style="margin-bottom: 10px;">Connect your store integrations (Shopify, Facebook, Google)</li>
                                <li style="margin-bottom: 10px;">Start tracking your metrics and insights</li>
                            </ol>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Questions? We're here to help!</p>
                        <p>Email us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p style="margin-top: 15px; font-size: 12px; color: #999;">
                            This login link will expire in 24 hours for security reasons.
                        </p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}

	private generateViewerWelcomeEmailTemplate(
		name: string,
		autoLoginToken: string,
	): string {
		const frontendUrl =
			this.configService.get<string>('FRONTEND_URL') || '';
		const autoLoginUrl = `${frontendUrl}/auth/auto-login?token=${encodeURIComponent(autoLoginToken)}`;

		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f4f4f4;
                        margin: 0;
                        padding: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background-color: #ffffff;
                        border-radius: 8px;
                        overflow: hidden;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    .header {
                        background: #10b981;
                        padding: 40px 30px;
                        text-align: center;
                        color: #ffffff;
                    }
                    .header h1 {
                        margin: 0 0 10px 0;
                        font-size: 32px;
                        font-weight: 600;
                    }
                    .header p {
                        margin: 0;
                        font-size: 16px;
                        opacity: 0.9;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .greeting {
                        font-size: 20px;
                        color: #333333;
                        margin-bottom: 20px;
                        font-weight: 600;
                    }
                    .message {
                        font-size: 16px;
                        color: #555555;
                        line-height: 1.8;
                        margin-bottom: 25px;
                    }
                    .feature-list {
                        background-color: #f0fdf4;
                        border-radius: 8px;
                        padding: 25px;
                        margin: 30px 0;
                    }
                    .feature-item {
                        display: flex;
                        align-items: flex-start;
                        margin-bottom: 15px;
                    }
                    .feature-item:last-child {
                        margin-bottom: 0;
                    }
                    .feature-icon {
                        font-size: 24px;
                        margin-right: 15px;
                        flex-shrink: 0;
                    }
                    .feature-text {
                        font-size: 15px;
                        color: #444444;
                        line-height: 1.5;
                    }
                    .feature-text strong {
                        color: #10b981;
                    }
                    .cta-button {
                        display: inline-block;
                        background: #10b981;
                        color: #ffffff !important;
                        text-decoration: none;
                        padding: 15px 40px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 16px;
                        margin: 20px 0;
                    }
                    .cta-button:hover {
                        opacity: 0.9;
                    }
                    .auto-login-note {
                        background-color: #dbeafe;
                        border-left: 4px solid #10b981;
                        padding: 15px;
                        margin: 20px 0;
                        font-size: 14px;
                        color: #065f46;
                    }
                    .footer {
                        background-color: #f8f9fa;
                        padding: 20px 30px;
                        text-align: center;
                        font-size: 14px;
                        color: #666666;
                        border-top: 1px solid #e0e0e0;
                    }
                    .footer a {
                        color: #10b981;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Ad Matrix!</h1>
                        <p>Your viewer account is ready</p>
                    </div>
                    <div class="content">
                        <div class="greeting">Hello ${name}!</div>
                        <div class="message">
                            Welcome aboard! Your Ad Matrix viewer account has been successfully created. You now have access to view analytics and performance metrics for your assigned stores.
                        </div>
                        <div class="auto-login-note">
                            🚀 <strong>Quick Start:</strong> Click the button below to access your dashboard instantly — no need to log in!
                        </div>
                        <center>
                            <a href="${autoLoginUrl}" class="cta-button">Access Your Dashboard</a>
                        </center>
                        <div class="feature-list">
                            <div class="feature-item">
                                <div class="feature-icon">📊</div>
                                <div class="feature-text">
                                    <strong>Store Analytics:</strong> View real-time orders, revenue, and items sold
                                </div>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">💰</div>
                                <div class="feature-text">
                                    <strong>Ad Spend Insights:</strong> Track Facebook and Google advertising expenditure
                                </div>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">🏆</div>
                                <div class="feature-text">
                                    <strong>Top Products:</strong> Discover best-performing products by revenue and quantity
                                </div>
                            </div>
                            <div class="feature-item">
                                <div class="feature-icon">📈</div>
                                <div class="feature-text">
                                    <strong>Traffic Metrics:</strong> Analyze landing page performance and conversion rates
                                </div>
                            </div>
                        </div>
                        <div class="message">
                            <strong>Getting Started:</strong>
                            <ol style="padding-left: 20px; margin-top: 15px;">
                                <li style="margin-bottom: 10px;">Click the button above to access your dashboard</li>
                                <li style="margin-bottom: 10px;">Explore the analytics for your assigned stores</li>
                                <li style="margin-bottom: 10px;">Review performance metrics and insights</li>
                            </ol>
                        </div>
                        <div class="message">
                            <strong>Note:</strong> As a viewer, you have read-only access to store analytics. If you need additional permissions or have questions, please contact your store manager.
                        </div>
                    </div>
                    <div class="footer">
                        <p>Questions? We're here to help!</p>
                        <p>Email us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p style="margin-top: 15px; font-size: 12px; color: #999;">
                            This login link will expire in 24 hours for security reasons.
                        </p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}

	private generateInvitationEmailTemplate(
		inviterName: string,
		storeName: string,
		invitationUrl: string,
	): string {
		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .header { background: #1D4ED8; padding: 40px 30px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0 0 10px 0; font-size: 32px; font-weight: 600; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 20px; color: #333333; margin-bottom: 20px; font-weight: 600; }
                    .message { font-size: 16px; color: #555555; line-height: 1.8; margin-bottom: 25px; }
                    .store-info { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #2563EB; }
                    .store-info strong { color: #2563EB; font-size: 18px; }
                    .cta-button { display: inline-block; background: #2563EB; color: #ffffff !important; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
                    .info-box { background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; font-size: 14px; color: #0d47a1; }
                    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #e0e0e0; }
                    .footer a { color: #667eea; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>You're Invited! 🎉</h1>
                        <p>Join Ad Matrix and start tracking metrics</p>
                    </div>
                    <div class="content">
                        <div class="greeting">Hello!</div>
                        <div class="message">
                            <strong>${inviterName}</strong> has invited you to join Ad Matrix as a Viewer to access store analytics and performance metrics.
                        </div>
                        <div class="store-info">
                            <strong>Store:</strong> ${storeName}<br/>
                            <div style="margin-top: 10px; font-size: 14px; color: #666;">
                                You'll have view-only access to track orders, revenue, ad spend, and product performance.
                            </div>
                        </div>
                        <div class="info-box">
                            🚀 <strong>Next Step:</strong> Click below to set up your password and access your dashboard
                        </div>
                        <center>
                            <a href="${invitationUrl}" class="cta-button">Accept Invitation & Set Password</a>
                        </center>
                        <div class="message" style="margin-top: 30px;">
                            <strong>What you'll get:</strong>
                            <ul style="padding-left: 20px; margin-top: 15px;">
                                <li style="margin-bottom: 10px;">Real-time store performance analytics</li>
                                <li style="margin-bottom: 10px;">Ad spend tracking across platforms</li>
                                <li style="margin-bottom: 10px;">Product performance insights</li>
                                <li style="margin-bottom: 10px;">Traffic and conversion metrics</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Questions? Contact us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p style="margin-top: 15px; font-size: 12px; color: #999;">This invitation expires in 7 days.</p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}

	private generateStoreAssignmentTemplate(
		viewerName: string,
		managerName: string,
		storeNames: string[],
	): string {
		const frontendUrl =
			this.configService.get<string>('FRONTEND_URL') || '';
		const storeList = storeNames
			.map((name) => `<li style="margin-bottom: 8px;">📊 ${name}</li>`)
			.join('');

		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .header { background: #10b981; padding: 40px 30px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0 0 10px 0; font-size: 32px; font-weight: 600; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 20px; color: #333333; margin-bottom: 20px; font-weight: 600; }
                    .message { font-size: 16px; color: #555555; line-height: 1.8; margin-bottom: 25px; }
                    .stores-box { background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #10b981; }
                    .stores-box h3 { margin: 0 0 15px 0; color: #10b981; font-size: 18px; }
                    .stores-box ul { list-style: none; padding: 0; margin: 0; }
                    .cta-button { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
                    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #e0e0e0; }
                    .footer a { color: #667eea; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>New Store Access! 🎉</h1>
                        <p>You've been granted access to additional stores</p>
                    </div>
                    <div class="content">
                        <div class="greeting">Hi ${viewerName}!</div>
                        <div class="message">
                            <strong>${managerName}</strong> has granted you access to view analytics for the following store(s):
                        </div>
                        <div class="stores-box">
                            <h3>New Stores Assigned:</h3>
                            <ul>${storeList}</ul>
                        </div>
                        <div class="message">
                            You can now view real-time metrics, track performance, and analyze data for these stores directly from your Ad Matrix dashboard.
                        </div>
                        <center>
                            <a href="${frontendUrl}" class="cta-button">View Dashboard</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Questions? Contact us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}

	private generatePasswordResetOtpTemplate(
		name: string,
		otp: string,
	): string {
		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .header { background: #dc2626; padding: 30px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 18px; color: #333333; margin-bottom: 20px; }
                    .message { font-size: 16px; color: #555555; line-height: 1.6; margin-bottom: 30px; }
                    .otp-box { background-color: #fef2f2; border: 2px dashed #dc2626; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0; }
                    .otp-label { font-size: 14px; color: #666666; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
                    .otp-code { font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 8px; font-family: 'Courier New', monospace; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; font-size: 14px; color: #856404; }
                    .security-notice { background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; font-size: 14px; color: #1e40af; }
                    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #e0e0e0; }
                    .footer a { color: #667eea; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔒 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <div class="greeting">Hi ${name},</div>
                        <div class="message">
                            We received a request to reset your password for your Ad Matrix account. Use the verification code below to proceed with resetting your password:
                        </div>
                        <div class="otp-box">
                            <div class="otp-label">Your Reset Code</div>
                            <div class="otp-code">${otp}</div>
                        </div>
                        <div class="warning">
                            ⚠️ <strong>Important:</strong> This code will expire in 10 minutes. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
                        </div>
                        <div class="security-notice">
                            🛡️ <strong>Security Tip:</strong> Never share this code with anyone. Ad Matrix staff will never ask for your verification code.
                        </div>
                    </div>
                    <div class="footer">
                        <p>If you're having trouble, contact us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
	    `;
	}

	private generatePasswordResetConfirmationTemplate(name: string): string {
		const frontendUrl =
			this.configService.get<string>('FRONTEND_URL') || '';
		const loginUrl = `${frontendUrl}/auth/login`;

		return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<style>
				body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
				.container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
				.header { background: #10b981; padding: 40px 30px; text-align: center; color: #ffffff; }
				.header h1 { margin: 0 0 10px 0; font-size: 32px; font-weight: 600; }
				.header p { margin: 0; font-size: 16px; opacity: 0.9; }
				.content { padding: 40px 30px; }
				.greeting { font-size: 20px; color: #333333; margin-bottom: 20px; font-weight: 600; }
				.message { font-size: 16px; color: #555555; line-height: 1.8; margin-bottom: 25px; }
				.success-box { background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px; }
				.success-box strong { color: #10b981; }
				.cta-button { display: inline-block; background: #10b981; color: #ffffff !important; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
				.security-notice { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; font-size: 14px; color: #856404; }
				.footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #e0e0e0; }
				.footer a { color: #667eea; text-decoration: none; }
			</style>
		</head>
		<body>
			<div class="container">
				<div class="header">
					<h1>✓ Password Changed!</h1>
					<p>Your password has been successfully updated</p>
				</div>
				<div class="content">
					<div class="greeting">Hi ${name},</div>
					<div class="message">
						Your password has been successfully changed. You can now log in to your Ad Matrix account using your new password.
					</div>
					<div class="success-box">
						<strong>✓ Password Updated:</strong> Your account is secure with your new password.
					</div>
					<center>
						<a href="${loginUrl}" class="cta-button">Login to Your Account</a>
					</center>
					<div class="security-notice">
						⚠️ <strong>Security Alert:</strong> If you did not make this change, please contact our support team immediately at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a>
					</div>
					<div class="message">
						<strong>Security Best Practices:</strong>
						<ul style="padding-left: 20px; margin-top: 15px;">
							<li style="margin-bottom: 10px;">Use a strong, unique password</li>
							<li style="margin-bottom: 10px;">Don't share your password with anyone</li>
							<li style="margin-bottom: 10px;">Enable two-factor authentication when available</li>
							<li>Log out from shared devices</li>
						</ul>
					</div>
				</div>
				<div class="footer">
					<p>Questions? Contact us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
					<p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
				</div>
			</div>
		</body>
		</html>
	`;
	}

	private generatePasswordChangeConfirmationTemplate(name: string): string {
		const frontendUrl =
			this.configService.get<string>('FRONTEND_URL') || '';

		return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .header { background: #10b981; padding: 40px 30px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0 0 10px 0; font-size: 32px; font-weight: 600; }
                    .header p { margin: 0; font-size: 16px; opacity: 0.9; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 20px; color: #333333; margin-bottom: 20px; font-weight: 600; }
                    .message { font-size: 16px; color: #555555; line-height: 1.8; margin-bottom: 25px; }
                    .info-box { background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px; }
                    .info-box .timestamp { font-size: 14px; color: #666; margin-top: 10px; }
                    .security-notice { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; font-size: 14px; color: #856404; }
                    .footer { background-color: #f8f9fa; padding: 20px 30px; text-align: center; font-size: 14px; color: #666666; border-top: 1px solid #e0e0e0; }
                    .footer a { color: #667eea; text-decoration: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Password Changed</h1>
                        <p>Your account password has been updated</p>
                    </div>
                    <div class="content">
                        <div class="greeting">Hi ${name},</div>
                        <div class="message">
                            This is a confirmation that your password for your Ad Matrix account was successfully changed.
                        </div>
                        <div class="info-box">
                            <strong>✓ Password Updated</strong>
                            <div class="timestamp">Changed on: ${new Date().toLocaleString(
								'en-US',
								{
									weekday: 'long',
									year: 'numeric',
									month: 'long',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
									timeZoneName: 'short',
								},
							)}</div>
                        </div>
                        <div class="security-notice">
                            ⚠️ <strong>Security Alert:</strong> If you did not make this change, your account may have been compromised. Please contact our support team immediately at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a>
                        </div>
                        <div class="message">
                            <strong>Security Recommendations:</strong>
                            <ul style="padding-left: 20px; margin-top: 15px;">
                                <li style="margin-bottom: 10px;">Use a strong, unique password for your account</li>
                                <li style="margin-bottom: 10px;">Never share your password with anyone</li>
                                <li style="margin-bottom: 10px;">Update your password regularly</li>
                                <li>Always log out from shared or public devices</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Questions or concerns? Contact us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
	    `;
	}
}

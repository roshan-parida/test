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
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
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
			this.logger.log(`OTP email sent successfully to ${email}`);
		} catch (error) {
			this.logger.error(`Failed to send OTP email to ${email}:`, error);
			throw error;
		}
	}

	async sendWelcomeEmail(email: string, name: string): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
			);
			return;
		}

		const subject = 'Welcome to Ad Matrix!';
		const html = this.generateWelcomeEmailTemplate(name);

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

	// Future-ready: Send custom emails (for reports, metrics, etc.)
	async sendCustomEmail(
		to: string,
		subject: string,
		html: string,
		attachments?: any[],
	): Promise<void> {
		if (!this.transporter) {
			this.logger.warn(
				'Mail transporter not initialized. Skipping email.',
			);
			return;
		}

		try {
			await this.transporter.sendMail({
				to,
				subject,
				html,
				attachments,
			});
			this.logger.log(`Custom email sent successfully to ${to}`);
		} catch (error) {
			this.logger.error(`Failed to send custom email to ${to}:`, error);
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
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                        border: 2px dashed #667eea;
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
                        color: #667eea;
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
                        <h1>🎯 Ad Matrix</h1>
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
                        <p>Need help? Contact us at <a href="mailto:support@admatrix.com">support@admatrix.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}

	private generateWelcomeEmailTemplate(name: string): string {
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
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #ffffff;
                        text-decoration: none;
                        padding: 15px 40px;
                        border-radius: 6px;
                        font-weight: 600;
                        font-size: 16px;
                        margin: 20px 0;
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
                        <h1>🎉 Welcome to Ad Matrix!</h1>
                        <p>Your account has been successfully created</p>
                    </div>
                    <div class="content">
                        <div class="greeting">Hello ${name}!</div>
                        <div class="message">
                            Congratulations! Your Ad Matrix account is now active and ready to help you optimize your advertising campaigns and track your store performance like never before.
                        </div>
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
                                <li style="margin-bottom: 10px;">Log in to your dashboard</li>
                                <li style="margin-bottom: 10px;">Connect your store integrations (Shopify, Facebook, Google)</li>
                                <li style="margin-bottom: 10px;">Start tracking your metrics and insights</li>
                            </ol>
                        </div>
                        <center>
                            <a href="${this.configService.get<string>('FRONTEND_URL') || ''}" class="cta-button">Go to Dashboard</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Questions? We're here to help!</p>
                        <p>Email us at <a href="mailto:ashutosh@codetocouture.com">ashutosh@codetocouture.com</a></p>
                        <p>&copy; ${new Date().getFullYear()} Ad Matrix. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
		`;
	}
}

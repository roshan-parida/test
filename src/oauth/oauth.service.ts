import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditStatus } from '../audit/schemas/audit-log.schema';

export interface OAuthState {
	userId: string;
	storeId?: string;
	provider: 'shopify' | 'meta' | 'google';
	returnUrl: string;
	timestamp: number;
}

export interface TokenResponse {
	accessToken: string;
	refreshToken?: string;
	expiresIn?: number;
	scope?: string;
	additionalData?: any;
}

@Injectable()
export class OAuthService {
	private readonly logger = new Logger(OAuthService.name);
	private readonly stateStore = new Map<string, OAuthState>();

	constructor(
		private readonly configService: ConfigService,
		private readonly httpService: HttpService,
		private readonly auditService: AuditService,
	) {
		// Clean up expired states every 10 minutes
		setInterval(() => this.cleanupExpiredStates(), 600000);
	}

	// Generate OAuth state token
	generateState(state: OAuthState): string {
		const stateToken = crypto.randomBytes(32).toString('hex');
		this.stateStore.set(stateToken, {
			...state,
			timestamp: Date.now(),
		});
		return stateToken;
	}

	// Verify and retrieve state
	verifyState(stateToken: string): OAuthState | null {
		const state = this.stateStore.get(stateToken);
		if (!state) return null;

		// Check if state is expired (15 minutes)
		if (Date.now() - state.timestamp > 900000) {
			this.stateStore.delete(stateToken);
			return null;
		}

		this.stateStore.delete(stateToken);
		return state;
	}

	// Clean up expired states
	private cleanupExpiredStates(): void {
		const now = Date.now();
		for (const [token, state] of this.stateStore.entries()) {
			if (now - state.timestamp > 900000) {
				this.stateStore.delete(token);
			}
		}
	}

	// ==================== SHOPIFY OAUTH ====================

	getShopifyAuthUrl(
		userId: string,
		shopDomain: string,
		storeId?: string,
	): string {
		const clientId = this.configService.get<string>('SHOPIFY_CLIENT_ID');
		const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/oauth/shopify/callback`;
		const scopes = this.configService.get<string>('SHOPIFY_SCOPES');
		const state = this.generateState({
			userId,
			storeId,
			provider: 'shopify',
			returnUrl: `${this.configService.get<string>('FRONTEND_URL')}/stores`,
			timestamp: Date.now(),
		});

		const nonce = crypto.randomBytes(16).toString('hex');

		return `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&grant_options[]`;
	}

	async exchangeShopifyCode(
		code: string,
		shopDomain: string,
		hmac: string,
		state: string,
	): Promise<{ token: TokenResponse; state: OAuthState }> {
		try {
			// Verify HMAC
			const verifiedHmac = this.verifyShopifyHmac(
				{ code, shop: shopDomain, state },
				hmac,
			);
			if (!verifiedHmac) {
				throw new BadRequestException('Invalid HMAC signature');
			}

			// Verify state
			const stateData = this.verifyState(state);
			if (!stateData) {
				throw new BadRequestException('Invalid or expired state');
			}

			const clientId =
				this.configService.get<string>('SHOPIFY_CLIENT_ID');
			const clientSecret = this.configService.get<string>(
				'SHOPIFY_CLIENT_SECRET',
			);
			const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/oauth/shopify/callback`;

			const response = await firstValueFrom(
				this.httpService.post(
					`https://${shopDomain}/admin/oauth/access_token`,
					{
						client_id: clientId,
						client_secret: clientSecret,
						code,
					},
				),
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.SUCCESS,
				userId: stateData.userId,
				metadata: {
					provider: 'shopify',
					shopDomain,
					scopes: response.data.scope,
				},
			});

			return {
				token: {
					accessToken: response.data.access_token,
					scope: response.data.scope,
					additionalData: {
						shopDomain,
						shopifyStoreUrl: shopDomain,
					},
				},
				state: stateData,
			};
		} catch (error) {
			this.logger.error(`Shopify OAuth error: ${(error as any).message}`);
			throw new BadRequestException('Failed to exchange Shopify code');
		}
	}

	private verifyShopifyHmac(params: any, hmac: string): boolean {
		const clientSecret = this.configService.get<string>(
			'SHOPIFY_CLIENT_SECRET',
		);

		if (!clientSecret) {
			throw new BadRequestException(
				'Shopify client secret is not configured',
			);
		}

		// Remove hmac and signature from params
		const { hmac: _, signature: __, ...filteredParams } = params;

		// Create query string
		const queryString = Object.keys(filteredParams)
			.sort()
			.map((key) => `${key}=${filteredParams[key]}`)
			.join('&');

		// Calculate HMAC
		const calculatedHmac = crypto
			.createHmac('sha256', clientSecret)
			.update(queryString)
			.digest('hex');

		return crypto.timingSafeEqual(
			Buffer.from(hmac),
			Buffer.from(calculatedHmac),
		);
	}

	// ==================== META (FACEBOOK) OAUTH ====================

	getMetaAuthUrl(userId: string, storeId?: string): string {
		const appId = this.configService.get<string>('META_APP_ID');
		const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/oauth/meta/callback`;
		const scopes = this.configService.get<string>('META_SCOPES');
		const state = this.generateState({
			userId,
			storeId,
			provider: 'meta',
			returnUrl: `${this.configService.get<string>('FRONTEND_URL')}/stores`,
			timestamp: Date.now(),
		});

		return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&response_type=code`;
	}

	async exchangeMetaCode(
		code: string,
		state: string,
	): Promise<{ token: TokenResponse; state: OAuthState; adAccounts: any[] }> {
		try {
			// Verify state
			const stateData = this.verifyState(state);
			if (!stateData) {
				throw new BadRequestException('Invalid or expired state');
			}

			const appId = this.configService.get<string>('META_APP_ID');
			const appSecret = this.configService.get<string>('META_APP_SECRET');
			const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/oauth/meta/callback`;

			// Exchange code for access token
			const tokenResponse = await firstValueFrom(
				this.httpService.get(
					`https://graph.facebook.com/v19.0/oauth/access_token`,
					{
						params: {
							client_id: appId,
							client_secret: appSecret,
							redirect_uri: redirectUri,
							code,
						},
					},
				),
			);

			const accessToken = tokenResponse.data.access_token;

			// Get long-lived token
			const longLivedResponse = await firstValueFrom(
				this.httpService.get(
					`https://graph.facebook.com/v19.0/oauth/access_token`,
					{
						params: {
							grant_type: 'fb_exchange_token',
							client_id: appId,
							client_secret: appSecret,
							fb_exchange_token: accessToken,
						},
					},
				),
			);

			const longLivedToken = longLivedResponse.data.access_token;

			// Fetch ad accounts
			const adAccountsResponse = await firstValueFrom(
				this.httpService.get(
					`https://graph.facebook.com/v19.0/me/adaccounts`,
					{
						params: {
							access_token: longLivedToken,
							fields: 'id,name,account_id,account_status,currency',
						},
					},
				),
			);

			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_STARTED,
				status: AuditStatus.SUCCESS,
				userId: stateData.userId,
				metadata: {
					provider: 'meta',
					adAccountsFound: adAccountsResponse.data.data.length,
				},
			});

			return {
				token: {
					accessToken: longLivedToken,
					expiresIn: longLivedResponse.data.expires_in,
				},
				state: stateData,
				adAccounts: adAccountsResponse.data.data,
			};
		} catch (error) {
			this.logger.error(`Meta OAuth error: ${(error as any).message}`);
			throw new BadRequestException('Failed to exchange Meta code');
		}
	}

	// ==================== GOOGLE OAUTH ====================

	getGoogleAuthUrl(userId: string, storeId?: string): string {
		const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
		const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/oauth/google/callback`;
		const scopes = this.configService.get<string>('GOOGLE_SCOPES') || '';
		const state = this.generateState({
			userId,
			storeId,
			provider: 'google',
			returnUrl: `${this.configService.get<string>('FRONTEND_URL')}/stores`,
			timestamp: Date.now(),
		});

		return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code&access_type=offline&prompt=consent`;
	}

	async exchangeGoogleCode(
		code: string,
		state: string,
	): Promise<{ token: TokenResponse; state: OAuthState; customers: any[] }> {
		try {
			// Verify state
			const stateData = this.verifyState(state);
			if (!stateData) {
				throw new BadRequestException('Invalid or expired state');
			}

			const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
			const clientSecret = this.configService.get<string>(
				'GOOGLE_CLIENT_SECRET',
			);
			const redirectUri = `${this.configService.get<string>('BACKEND_URL')}/api/oauth/google/callback`;

			// Exchange code for tokens
			const tokenResponse = await firstValueFrom(
				this.httpService.post('https://oauth2.googleapis.com/token', {
					code,
					client_id: clientId,
					client_secret: clientSecret,
					redirect_uri: redirectUri,
					grant_type: 'authorization_code',
				}),
			);

			const { access_token, refresh_token, expires_in } =
				tokenResponse.data;

			// Fetch accessible customer accounts (Google Ads accounts)
			// Note: This requires Google Ads API setup
			const customers: any[] = [];

			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_STARTED,
				status: AuditStatus.SUCCESS,
				userId: stateData.userId,
				metadata: {
					provider: 'google',
					hasRefreshToken: !!refresh_token,
				},
			});

			return {
				token: {
					accessToken: access_token,
					refreshToken: refresh_token,
					expiresIn: expires_in,
				},
				state: stateData,
				customers,
			};
		} catch (error) {
			this.logger.error(`Google OAuth error: ${(error as any).message}`);
			throw new BadRequestException('Failed to exchange Google code');
		}
	}

	// ==================== TOKEN REFRESH ====================

	async refreshGoogleToken(refreshToken: string): Promise<TokenResponse> {
		try {
			const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
			const clientSecret = this.configService.get<string>(
				'GOOGLE_CLIENT_SECRET',
			);

			const response = await firstValueFrom(
				this.httpService.post('https://oauth2.googleapis.com/token', {
					refresh_token: refreshToken,
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: 'refresh_token',
				}),
			);

			return {
				accessToken: response.data.access_token,
				expiresIn: response.data.expires_in,
			};
		} catch (error) {
			this.logger.error(
				`Google token refresh error: ${(error as any).message}`,
			);
			throw new BadRequestException('Failed to refresh Google token');
		}
	}
}

import {
	Controller,
	Get,
	Query,
	Res,
	UseGuards,
	Req,
	Logger,
	BadRequestException,
	Body,
	Param,
	Post,
} from '@nestjs/common';
import type { Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiQuery,
	ApiBody,
	ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { OAuthService } from './oauth.service';
import { StoresService } from '../stores/stores.service';
import { StoreAccessGuard } from 'src/auth/guards/store-access.guard';

@ApiTags('OAuth')
@Controller('oauth')
export class OAuthController {
	private readonly logger = new Logger(OAuthController.name);

	constructor(
		private readonly oauthService: OAuthService,
		private readonly storesService: StoresService,
	) {}

	// ==================== SHOPIFY ====================
	@Get('shopify/authorize')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({ summary: 'Initiate Shopify OAuth flow' })
	@ApiQuery({
		name: 'shopDomain',
		required: true,
		description: 'Shopify store domain (e.g., mystore.myshopify.com)',
	})
	@ApiQuery({
		name: 'storeId',
		required: false,
		description: 'Existing store ID to update (optional)',
	})
	async shopifyAuthorize(
		@Query('shopDomain') shopDomain: string,
		@Query('storeId') storeId: string | undefined,
		@Req() req: any,
	) {
		if (!shopDomain) {
			throw new BadRequestException('shopDomain is required');
		}

		const authUrl = this.oauthService.getShopifyAuthUrl(
			req.user.userId,
			shopDomain,
			storeId,
		);

		this.logger.log(`OAuth URL generated for user ${req.user.userId}`);

		return { authUrl };
	}

	@Get('shopify/callback')
	@ApiOperation({ summary: 'Shopify OAuth callback' })
	@ApiQuery({ name: 'code', required: true })
	@ApiQuery({ name: 'shop', required: true })
	@ApiQuery({ name: 'hmac', required: true })
	@ApiQuery({ name: 'state', required: true })
	async shopifyCallback(
		@Query('code') code: string,
		@Query('shop') shop: string,
		@Query('hmac') hmac: string,
		@Query('state') state: string,
		@Res() res: Response,
	) {
		try {
			const result = await this.oauthService.exchangeShopifyCode(
				code,
				shop,
				hmac,
				state,
			);

			// Update or create store with the token
			if (result.state.storeId) {
				// Update existing store
				await this.storesService.update(result.state.storeId, {
					shopifyToken: result.token.accessToken,
					shopifyStoreUrl: shop,
				});
				this.logger.log(
					`Updated store ${result.state.storeId} with Shopify credentials`,
				);
			}

			// Redirect to frontend with success
			const redirectUrl = `${result.state.returnUrl}?oauth=shopify&status=success&storeId=${result.state.storeId || ''}&shopDomain=${shop}`;
			return res.redirect(redirectUrl);
		} catch (error) {
			this.logger.error(
				`Shopify callback error: ${(error as any).message}`,
			);
			const errorUrl = `${this.oauthService['configService'].get<string>('FRONTEND_URL')}/stores?oauth=shopify&status=error&message=${encodeURIComponent((error as any).message)}`;
			return res.redirect(errorUrl);
		}
	}

	// ==================== META (FACEBOOK) ====================
	@Get('meta/authorize')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({ summary: 'Initiate Meta (Facebook) OAuth flow' })
	@ApiQuery({
		name: 'storeId',
		required: false,
		description: 'Existing store ID to update (optional)',
	})
	async metaAuthorize(
		@Query('storeId') storeId: string | undefined,
		@Req() req: any,
	) {
		const authUrl = this.oauthService.getMetaAuthUrl(
			req.user.userId,
			storeId,
		);

		this.logger.log(`Meta OAuth URL generated for user ${req.user.userId}`);
		return { authUrl };
	}

	@Get('meta/callback')
	@ApiOperation({ summary: 'Meta OAuth callback' })
	@ApiQuery({ name: 'code', required: true })
	@ApiQuery({ name: 'state', required: true })
	async metaCallback(
		@Query('code') code: string,
		@Query('state') state: string,
		@Res() res: Response,
	) {
		try {
			const result = await this.oauthService.exchangeMetaCode(
				code,
				state,
			);

			// Return ad accounts for user selection
			const redirectUrl = `${result.state.returnUrl}?oauth=meta&status=success&storeId=${result.state.storeId || ''}&adAccounts=${encodeURIComponent(JSON.stringify(result.adAccounts))}&token=${encodeURIComponent(result.token.accessToken)}`;

			this.logger.log(
				`Meta OAuth successful for user ${result.state.userId}, found ${result.adAccounts.length} ad accounts`,
			);

			return res.redirect(redirectUrl);
		} catch (error) {
			this.logger.error(`Meta callback error: ${(error as any).message}`);
			const errorUrl = `${this.oauthService['configService'].get<string>('FRONTEND_URL')}/stores?oauth=meta&status=error&message=${encodeURIComponent((error as any).message)}`;
			return res.redirect(errorUrl);
		}
	}

	// ==================== GOOGLE ====================
	@Get('google/authorize')
	@UseGuards(JwtAuthGuard, RolesGuard)
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({ summary: 'Initiate Google OAuth flow' })
	@ApiQuery({
		name: 'storeId',
		required: false,
		description: 'Existing store ID to update (optional)',
	})
	async googleAuthorize(
		@Query('storeId') storeId: string | undefined,
		@Req() req: any,
	) {
		const authUrl = this.oauthService.getGoogleAuthUrl(
			req.user.userId,
			storeId,
		);

		this.logger.log(
			`Google OAuth URL generated for user ${req.user.userId}`,
		);
		return { authUrl };
	}

	@Get('google/callback')
	@ApiOperation({ summary: 'Google OAuth callback' })
	@ApiQuery({ name: 'code', required: true })
	@ApiQuery({ name: 'state', required: true })
	async googleCallback(
		@Query('code') code: string,
		@Query('state') state: string,
		@Res() res: Response,
	) {
		try {
			const result = await this.oauthService.exchangeGoogleCode(
				code,
				state,
			);

			// Return customer accounts for user selection
			const redirectUrl = `${result.state.returnUrl}?oauth=google&status=success&storeId=${result.state.storeId || ''}&customers=${encodeURIComponent(JSON.stringify(result.customers))}&token=${encodeURIComponent(result.token.accessToken)}&refreshToken=${encodeURIComponent(result.token.refreshToken || '')}`;

			this.logger.log(
				`Google OAuth successful for user ${result.state.userId}, found ${result.customers.length} customer accounts`,
			);

			return res.redirect(redirectUrl);
		} catch (error) {
			this.logger.error(
				`Google callback error: ${(error as any).message}`,
			);
			const errorUrl = `${this.oauthService['configService'].get<string>('FRONTEND_URL')}/stores?oauth=google&status=error&message=${encodeURIComponent((error as any).message)}`;
			return res.redirect(errorUrl);
		}
	}

	@Post(':storeId/oauth-credentials/:provider')
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseGuards(JwtAuthGuard, StoreAccessGuard)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({
		summary: 'Save OAuth credentials after provider selection',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiParam({ name: 'provider', enum: ['shopify', 'meta', 'google'] })
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				accessToken: { type: 'string' },
				refreshToken: { type: 'string' },
				expiresIn: { type: 'number' },
				accountId: {
					type: 'string',
					description: 'FB account ID or Google customer ID',
				},
			},
			required: ['accessToken'],
		},
	})
	async saveOAuthCredentials(
		@Param('storeId') storeId: string,
		@Param('provider') provider: 'shopify' | 'meta' | 'google',
		@Body('accessToken') accessToken: string,
		@Body('refreshToken') refreshToken?: string,
		@Body('expiresIn') expiresIn?: number,
		@Body('accountId') accountId?: string,
	) {
		const credentials: any = {
			accessToken,
			refreshToken,
			expiresIn,
		};

		if (provider === 'meta' && accountId) {
			credentials.additionalData = { accountId };
		} else if (provider === 'google' && accountId) {
			credentials.additionalData = { customerId: accountId };
		}

		const store = await this.storesService.saveOAuthCredentials(
			storeId,
			provider,
			credentials,
		);

		return {
			message: `${provider} credentials saved successfully`,
			storeId: store._id,
			storeName: store.name,
		};
	}
}

import {
	Controller,
	Get,
	Query,
	Res,
	UseGuards,
	Req,
	Logger,
	BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { OAuthService } from './oauth.service';
import { StoresService } from '../stores/stores.service';

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
	@ApiResponse({ status: 302, description: 'Redirect to Shopify OAuth' })
	async shopifyAuthorize(
		@Query('shopDomain') shopDomain: string,
		@Query('storeId') storeId: string | undefined,
		@Req() req: any,
		@Res() res: Response,
	) {
		if (!shopDomain) {
			throw new BadRequestException('shopDomain is required');
		}

		const authUrl = this.oauthService.getShopifyAuthUrl(
			req.user.userId,
			shopDomain,
			storeId,
		);

		this.logger.log(
			`Redirecting to Shopify OAuth for user ${req.user.userId}`,
		);
		return res.redirect(authUrl);
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
	@ApiResponse({ status: 302, description: 'Redirect to Meta OAuth' })
	async metaAuthorize(
		@Query('storeId') storeId: string | undefined,
		@Req() req: any,
		@Res() res: Response,
	) {
		const authUrl = this.oauthService.getMetaAuthUrl(
			req.user.userId,
			storeId,
		);

		this.logger.log(
			`Redirecting to Meta OAuth for user ${req.user.userId}`,
		);
		return res.redirect(authUrl);
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
	@ApiResponse({ status: 302, description: 'Redirect to Google OAuth' })
	async googleAuthorize(
		@Query('storeId') storeId: string | undefined,
		@Req() req: any,
		@Res() res: Response,
	) {
		const authUrl = this.oauthService.getGoogleAuthUrl(
			req.user.userId,
			storeId,
		);

		this.logger.log(
			`Redirecting to Google OAuth for user ${req.user.userId}`,
		);
		return res.redirect(authUrl);
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

			// Note: Google Ads API requires additional setup to fetch customer IDs
			// For now, we'll return the tokens and let the user manually enter their customer ID
			const redirectUrl = `${result.state.returnUrl}?oauth=google&status=success&storeId=${result.state.storeId || ''}&hasRefreshToken=${!!result.token.refreshToken}`;

			this.logger.log(
				`Google OAuth successful for user ${result.state.userId}`,
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
}

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Store } from '../../stores/schemas/store.schema';
import { ConfigService } from '@nestjs/config';

interface DailyAdSpend {
	date: string;
	spend: number;
}

@Injectable()
export class GoogleService {
	private readonly logger = new Logger(GoogleService.name);
	private readonly developerToken: string;
	private readonly googleAdsApiVersion = 'v22';

	constructor(private readonly configService: ConfigService) {
		this.developerToken =
			this.configService.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN') || '';

		if (!this.developerToken) {
			this.logger.warn(
				'Google Ads Developer Token not configured. Google Ads features will be disabled.',
			);
		}
	}

	private getISTDateString(date: Date): string {
		const istDate = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
		const year = istDate.getUTCFullYear();
		const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
		const day = String(istDate.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	private async getAccessToken(store: Store): Promise<string> {
		// Check if we have a valid access token
		// In a production environment, you'd check expiration and refresh if needed

		if (!store.googleRefreshToken) {
			throw new Error(
				'Google refresh token not found. Please re-authenticate.',
			);
		}

		// If token is expired or about to expire, refresh it
		const now = new Date();
		const expiresAt = store.googleTokenExpiresAt;

		if (
			!expiresAt ||
			now >= new Date(expiresAt.getTime() - 5 * 60 * 1000)
		) {
			// Token expired or expires in less than 5 minutes, refresh it
			return this.refreshAccessToken(store.googleRefreshToken);
		}

		// Assuming we store access token somewhere (you might need to add this to Store schema)
		// For now, we'll refresh every time to be safe
		return this.refreshAccessToken(store.googleRefreshToken);
	}

	private async refreshAccessToken(refreshToken: string): Promise<string> {
		try {
			const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
			const clientSecret = this.configService.get<string>(
				'GOOGLE_CLIENT_SECRET',
			);

			const response = await axios.post(
				'https://oauth2.googleapis.com/token',
				{
					refresh_token: refreshToken,
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: 'refresh_token',
				},
			);

			return response.data.access_token;
		} catch (error) {
			const err = error as AxiosError;
			this.logger.error(`Google token refresh failed: ${err.message}`);
			throw new Error(
				'Failed to refresh Google access token. Please re-authenticate.',
			);
		}
	}

	async fetchAdSpend(
		store: Store,
		from: Date,
		to: Date,
	): Promise<DailyAdSpend[]> {
		if (!this.developerToken) {
			this.logger.warn(
				'Google Ads Developer Token not configured. Returning empty data.',
			);
			return [];
		}

		if (!store.googleCustomerId) {
			this.logger.warn(
				`Google Customer ID not configured for store ${store.name}. Returning empty data.`,
			);
			return [];
		}

		try {
			this.logger.debug(
				`Fetching Google ad spend for ${store.name} from ${from.toISOString()} to ${to.toISOString()}`,
			);

			const accessToken = await this.getAccessToken(store);
			const customerId = store.googleCustomerId.replace(/-/g, '');

			const startDate = this.getISTDateString(from);
			const endDate = this.getISTDateString(to);

			// Google Ads Query Language (GAQL) query
			const query = `
				SELECT 
					segments.date,
					metrics.cost_micros
				FROM campaign
				WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
			`;

			this.logger.log(
				`Fetching Google Ads data for ${store.name}: ${startDate} to ${endDate}`,
			);

			const response = await axios.post(
				`https://googleads.googleapis.com/${this.googleAdsApiVersion}/customers/${customerId}/googleAds:searchStream`,
				{
					query: query.trim(),
				},
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'developer-token': this.developerToken,
						'Content-Type': 'application/json',
					},
				},
			);

			const dailySpendMap = new Map<string, number>();

			const results = response.data[0]?.results || [];

			for (const result of results) {
				const date = result.segments?.date;
				const costMicros = result.metrics?.costMicros || 0;

				const spend = parseFloat(costMicros) / 1000000;

				if (date) {
					const currentSpend = dailySpendMap.get(date) || 0;
					dailySpendMap.set(date, currentSpend + spend);
				}
			}

			const dailySpend: DailyAdSpend[] = Array.from(
				dailySpendMap.entries(),
			).map(([date, spend]) => ({
				date,
				spend: Math.round(spend * 100) / 100, // Round to 2 decimal places
			}));

			// Sort by date
			dailySpend.sort((a, b) => a.date.localeCompare(b.date));

			// Fill in missing dates with zero spend
			const currentDate = new Date(from);
			const endDate_date = new Date(to);
			const completeData: DailyAdSpend[] = [];

			while (currentDate <= endDate_date) {
				const dateStr = this.getISTDateString(currentDate);
				const existingData = dailySpend.find((d) => d.date === dateStr);

				completeData.push({
					date: dateStr,
					spend: existingData?.spend || 0,
				});

				currentDate.setDate(currentDate.getDate() + 1);
			}

			this.logger.log(
				`✓ Retrieved ${completeData.length} days of Google ad spend for ${store.name}`,
			);

			return completeData;
		} catch (error) {
			const err = error as AxiosError;

			if (err.response) {
				this.logger.error(
					`Google Ads API error (${err.response.status}): ${JSON.stringify(err.response.data)}`,
				);
			} else {
				this.logger.error(`Google Ads API error: ${err.message}`);
			}

			this.logger.warn(
				`Returning empty Google ad spend data for ${store.name}`,
			);
			return [];
		}
	}

	async testConnection(
		store: Store,
	): Promise<{ success: boolean; message: string }> {
		if (!this.developerToken) {
			return {
				success: false,
				message: 'Google Ads Developer Token not configured',
			};
		}

		if (!store.googleCustomerId) {
			return {
				success: false,
				message: 'Google Customer ID not configured',
			};
		}

		try {
			const accessToken = await this.getAccessToken(store);
			const customerId = store.googleCustomerId.replace(/-/g, '');

			const query = `
				SELECT customer.id, customer.descriptive_name
				FROM customer
				WHERE customer.id = ${customerId}
				LIMIT 1
			`;

			const response = await axios.post(
				`https://googleads.googleapis.com/${this.googleAdsApiVersion}/customers/${customerId}/googleAds:searchStream`,
				{ query: query.trim() },
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'developer-token': this.developerToken,
						'Content-Type': 'application/json',
					},
				},
			);

			const customer = response.data[0]?.results?.[0]?.customer;

			return {
				success: true,
				message: `Connected to: ${customer?.descriptiveName || customerId}`,
			};
		} catch (error) {
			const err = error as AxiosError;
			return {
				success: false,
				message: err.response?.data
					? JSON.stringify(err.response.data)
					: err.message,
			};
		}
	}

	async getCampaignMetrics(
		store: Store,
		from: Date,
		to: Date,
	): Promise<any[]> {
		if (!this.developerToken || !store.googleCustomerId) {
			return [];
		}

		try {
			const accessToken = await this.getAccessToken(store);
			const customerId = store.googleCustomerId.replace(/-/g, '');
			const startDate = this.getISTDateString(from);
			const endDate = this.getISTDateString(to);

			const query = `
				SELECT 
					campaign.id,
					campaign.name,
					campaign.status,
					metrics.cost_micros,
					metrics.impressions,
					metrics.clicks,
					metrics.conversions,
					metrics.conversions_value
				FROM campaign
				WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
					AND campaign.status != 'REMOVED'
			`;

			const response = await axios.post(
				`https://googleads.googleapis.com/${this.googleAdsApiVersion}/customers/${customerId}/googleAds:searchStream`,
				{ query: query.trim() },
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'developer-token': this.developerToken,
						'Content-Type': 'application/json',
					},
				},
			);

			const campaigns = response.data[0]?.results || [];

			return campaigns.map((result: any) => ({
				id: result.campaign?.id,
				name: result.campaign?.name,
				status: result.campaign?.status,
				cost: parseFloat(result.metrics?.costMicros || 0) / 1000000,
				impressions: parseInt(result.metrics?.impressions || 0),
				clicks: parseInt(result.metrics?.clicks || 0),
				conversions: parseFloat(result.metrics?.conversions || 0),
				conversionsValue: parseFloat(
					result.metrics?.conversionsValue || 0,
				),
			}));
		} catch (error) {
			this.logger.error(
				`Failed to fetch campaign metrics: ${(error as any).message}`,
			);
			return [];
		}
	}
}

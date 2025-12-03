import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Store } from '../../stores/schemas/store.schema';
import { ConfigService } from '@nestjs/config';

interface DailyAdSpend {
	date: string;
	spend: number;
}

@Injectable()
export class FacebookService {
	private readonly logger = new Logger(FacebookService.name);

	constructor(private readonly config: ConfigService) {}

	private async callFacebook(
		url: string,
		params: any,
		retry = 0,
	): Promise<any> {
		try {
			const res = await axios.get(url, { params });
			return res.data;
		} catch (error) {
			const err = error as AxiosError;
			const errData = err.response?.data as any;

			if (errData?.error?.code === 17 && retry < 3) {
				this.logger.warn(`FB rate limit hit, retrying in 2 sec...`);
				await new Promise((res) => setTimeout(res, 2000));
				return this.callFacebook(url, params, retry + 1);
			}

			this.logger.error(
				`Facebook API Error: ${errData?.error?.message || err.message}`,
			);
			return null;
		}
	}

	async fetchAdSpend(
		store: Store,
		from: Date,
		to: Date,
	): Promise<DailyAdSpend[]> {
		const token = store.fbAdSpendToken;
		let adAccountId = store.fbAccountId;
		if (!adAccountId.startsWith('act_')) {
			adAccountId = `act_${adAccountId}`;
		}

		const url = `https://graph.facebook.com/v19.0/${adAccountId}/insights`;

		const params = {
			access_token: token,
			level: 'account',
			fields: 'spend,date_start',
			time_increment: 1,
			limit: 500,
			time_range: JSON.stringify({
				since: from.toISOString().slice(0, 10),
				until: to.toISOString().slice(0, 10),
			}),
		};

		this.logger.log(
			`Fetching FB ad spend for ${store.name}: ${params.time_range}`,
		);

		const data = await this.callFacebook(url, params);

		if (!data || !data.data || data.data.length === 0) {
			this.logger.warn(`No ad spend data returned for ${store.name}`);
			return [];
		}

		const dailySpend: DailyAdSpend[] = data.data.map((row: any) => ({
			date: row.date_start,
			spend: parseFloat(row.spend || '0'),
		}));

		this.logger.log(
			`✓ Retrieved ${dailySpend.length} days of ad spend for ${store.name}`,
		);

		return dailySpend;
	}
}

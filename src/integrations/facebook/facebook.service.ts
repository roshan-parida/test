import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { Store } from '../../stores/schemas/store.schema';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditStatus } from '../../audit/schemas/audit-log.schema';

interface DailyAdSpend {
	date: string;
	spend: number;
}

interface InsightMetrics {
	id: string;
	name: string;
	status?: string;
	objective?: string;
	campaignId?: string;
	campaignName?: string;
	adSetId?: string;
	adSetName?: string;
	results: number;
	detailedResults?: Array<{
		actionType: string;
		type: string;
		value: number;
	}>;
	reach: number;
	impressions: number;
	frequency: number;
	costPerResult: number;
	amountSpent: number;
	budget?: number;
	startTime?: string;
	endTime?: string;
	cpm: number;
	linkClicks: number;
	cpc: number;
	ctr: number;
	linkCtr: number;
	landingPageViews: number;
	resultRoas: number;
	resultsValue: number;
}

interface BreakdownMetrics extends Omit<
	InsightMetrics,
	'id' | 'name' | 'status' | 'objective' | 'budget' | 'startTime' | 'endTime'
> {
	dimension: string;
	value: string;
}

interface BatchResponse {
	code: number;
	headers: any[];
	body: string;
}

@Injectable()
export class FacebookService {
	private readonly logger = new Logger(FacebookService.name);
	private readonly API_VERSION = 'v19.0';
	private readonly BASE_URL = `https://graph.facebook.com/${this.API_VERSION}`;

	constructor(
		private readonly config: ConfigService,
		private readonly auditService: AuditService,
	) {}

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
			throw new Error(errData?.error?.message || err.message);
		}
	}

	async fetchAdSpend(
		store: Store,
		from: Date,
		to: Date,
	): Promise<DailyAdSpend[]> {
		try {
			const startTime = Date.now();
			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: { from: from.toISOString(), to: to.toISOString() },
			});

			const token = store.fbAdSpendToken;
			let adAccountId = store.fbAccountId;
			if (!adAccountId.startsWith('act_')) {
				adAccountId = `act_${adAccountId}`;
			}

			const url = `${this.BASE_URL}/${adAccountId}/insights`;

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
			await this.auditService.log({
				action: AuditAction.FACEBOOK_AD_SPEND_FETCHED,
				status: AuditStatus.SUCCESS,
				storeId: store._id.toString(),
				storeName: store.name,
				duration: Date.now() - startTime,
				metadata: { daysProcessed: dailySpend.length },
			});

			return dailySpend;
		} catch (error) {
			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId: store._id.toString(),
				storeName: store.name,
				errorMessage: (error as any).message,
				errorDetails: error,
			});
			throw error;
		}
	}

	private async callFacebookBatch(
		token: string,
		batchRequests: Array<{ method: string; relative_url: string }>,
	): Promise<BatchResponse[]> {
		try {
			const res = await axios.post(
				`${this.BASE_URL}/`,
				{
					access_token: token,
					batch: JSON.stringify(batchRequests),
				},
				{
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
				},
			);
			return res.data;
		} catch (error) {
			const err = error as AxiosError;
			const errData = err.response?.data as any;
			this.logger.error(
				`Facebook Batch API Error: ${errData?.error?.message || err.message}`,
			);
			throw new Error(errData?.error?.message || err.message);
		}
	}

	private getMetricFields(): string {
		return [
			'campaign_name',
			'campaign_id',
			'adset_name',
			'adset_id',
			'ad_name',
			'ad_id',
			'actions',
			'reach',
			'impressions',
			'frequency',
			'cost_per_action_type',
			'spend',
			'cpm',
			'clicks',
			'cpc',
			'ctr',
			'inline_link_clicks',
			'inline_link_click_ctr',
			'action_values',
		].join(',');
	}

	private mapActionTypeToName(actionType: string): string {
		const mapping: Record<string, string> = {
			'onsite_conversion.messaging_conversation_started_7d_click':
				'Messaging conversations started',
			messaging_conversation_started: 'Messaging conversations started',
			add_payment_info: 'Website payment info adds',
			add_to_cart: 'Website adds to cart',
			initiate_checkout: 'Website checkouts initiated',
			view_content: 'Website content views',
			lead: 'Leads',
			complete_registration: 'Registrations',
			purchase: 'Website purchases',
			'offsite_conversion.fb_pixel_purchase': 'Website purchases',
			landing_page_view: 'Landing page views',
			link_click: 'Link clicks',
			post_engagement: 'Post engagements',
			app_install: 'App installs',
			video_view: 'Video views',
		};

		return mapping[actionType] || actionType;
	}

	private calculateMetrics(insight: any, objective: string = ''): any {
		const spend = parseFloat(insight.spend || '0');
		const impressions = parseInt(insight.impressions || '0', 10);
		const reach = parseInt(insight.reach || '0', 10);
		const frequency = parseFloat(insight.frequency || '0');
		const clicks = parseInt(insight.clicks || '0', 10);
		const linkClicks = parseInt(insight.inline_link_clicks || '0', 10);

		const actions = insight.actions || [];
		const actionValues = insight.action_values || [];

		const detailedResults = actions.map((a: any) => ({
			actionType: a.action_type,
			type: this.mapActionTypeToName(a.action_type),
			value: parseInt(a.value || '0', 10),
		}));

		const getActionValue = (type: string) => {
			const action = actions.find((a: any) => a.action_type === type);
			return parseInt(action?.value || '0', 10);
		};

		const getActionCurrency = (type: string) => {
			const action = actionValues.find(
				(a: any) => a.action_type === type,
			);
			return parseFloat(action?.value || '0');
		};

		// Determine primary result based on objective
		let results = 0;
		switch (objective.toLowerCase()) {
			case 'conversions':
			case 'outcome_sales':
				results = getActionValue(
					'offsite_conversion.fb_pixel_purchase',
				);
				break;
			case 'lead_generation':
			case 'outcome_leads':
				results = getActionValue('lead');
				break;
			case 'link_clicks':
			case 'outcome_traffic':
				results = linkClicks;
				break;
			case 'post_engagement':
			case 'outcome_engagement':
				results = getActionValue('post_engagement');
				break;
			case 'app_installs':
			case 'outcome_app_promotion':
				results = getActionValue('app_install');
				break;
			case 'video_views':
				results = getActionValue('video_view');
				break;
			default:
				results =
					getActionValue('offsite_conversion.fb_pixel_purchase') ||
					linkClicks;
		}

		const resultsValue = getActionCurrency(
			'offsite_conversion.fb_pixel_purchase',
		);
		const landingPageViews = getActionValue('landing_page_view');

		return {
			results,
			detailedResults,
			reach,
			impressions,
			frequency: Math.round(frequency * 100) / 100,
			costPerResult:
				results > 0 ? Math.round((spend / results) * 100) / 100 : 0,
			amountSpent: Math.round(spend * 100) / 100,
			cpm:
				impressions > 0
					? Math.round((spend / impressions) * 1000 * 100) / 100
					: 0,
			linkClicks,
			cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
			ctr:
				impressions > 0
					? Math.round((clicks / impressions) * 10000) / 100
					: 0,
			linkCtr:
				impressions > 0
					? Math.round((linkClicks / impressions) * 10000) / 100
					: 0,
			landingPageViews,
			resultRoas:
				resultsValue > 0 && spend > 0
					? Math.round((resultsValue / spend) * 100) / 100
					: 0,
			resultsValue: Math.round(resultsValue * 100) / 100,
		};
	}

	private normalizeAccountId(accountId: string): string {
		return accountId.startsWith('act_') ? accountId : `act_${accountId}`;
	}

	async fetchInsights(
		store: Store,
		from: Date,
		to: Date,
		level: 'account' | 'campaign' | 'adset' | 'ad',
		breakdown?: string,
		entityId?: string,
		limit: number = 500,
	): Promise<InsightMetrics[] | BreakdownMetrics[]> {
		try {
			const startTime = Date.now();
			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId: store._id.toString(),
				storeName: store.name,
				metadata: {
					from: from.toISOString(),
					to: to.toISOString(),
					level,
					breakdown: breakdown || 'none',
					entityId: entityId || 'none',
					limit,
				},
			});

			const token = store.fbAdSpendToken;
			const adAccountId = this.normalizeAccountId(store.fbAccountId);

			// Determine the URL based on level and entityId
			let url: string;
			if (entityId) {
				url = `${this.BASE_URL}/${entityId}/insights`;
			} else if (level === 'account') {
				url = `${this.BASE_URL}/${adAccountId}/insights`;
			} else {
				url = `${this.BASE_URL}/${adAccountId}/insights`;
			}

			const params: any = {
				access_token: token,
				level: entityId ? undefined : level,
				fields: this.getMetricFields(),
				time_range: JSON.stringify({
					since: from.toISOString().slice(0, 10),
					until: to.toISOString().slice(0, 10),
				}),
				limit,
			};

			if (breakdown) {
				params.breakdowns = breakdown;
			}

			this.logger.log(
				`Fetching ${level} insights for ${store.name}${breakdown ? ` with breakdown: ${breakdown}` : ''}`,
			);

			const data = await this.callFacebook(url, params);

			if (!data || !data.data || data.data.length === 0) {
				this.logger.warn(
					`No ${level} insights data found for ${store.name}`,
				);
				return [];
			}

			// Handle pagination if needed
			let allData = [...data.data];
			let nextPage = data.paging?.next;

			while (nextPage && allData.length < limit) {
				const nextData = await axios.get(nextPage);
				if (nextData.data?.data) {
					allData = [...allData, ...nextData.data.data];
					nextPage = nextData.data.paging?.next;
				} else {
					break;
				}
			}

			// Process based on whether it's a breakdown or regular insight
			if (breakdown) {
				await this.auditService.log({
					action: AuditAction.FACEBOOK_INSIGHTS_FETCHED,
					status: AuditStatus.SUCCESS,
					storeId: store._id.toString(),
					storeName: store.name,
					duration: Date.now() - startTime,
					metadata: {
						recordsProcessed: allData.length,
						breakdown,
					},
				});
				return this.processBreakdownInsights(allData, breakdown);
			} else {
				await this.auditService.log({
					action: AuditAction.FACEBOOK_INSIGHTS_FETCHED,
					status: AuditStatus.SUCCESS,
					storeId: store._id.toString(),
					storeName: store.name,
					duration: Date.now() - startTime,
					metadata: {
						recordsProcessed: allData.length,
						level,
					},
				});
				return this.processRegularInsights(allData, level);
			}
		} catch (error) {
			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId: store._id.toString(),
				storeName: store.name,
				errorMessage: (error as any).message,
				errorDetails: error,
			});
			throw error;
		}
	}

	private processRegularInsights(
		data: any[],
		level: string,
	): InsightMetrics[] {
		return data.map((insight: any) => {
			const metrics = this.calculateMetrics(
				insight,
				insight.objective || '',
			);

			const result: InsightMetrics = {
				id:
					insight.campaign_id ||
					insight.adset_id ||
					insight.ad_id ||
					'unknown',
				name:
					insight.campaign_name ||
					insight.adset_name ||
					insight.ad_name ||
					'Unknown',
				...metrics,
			};

			// Add level-specific fields
			if (level === 'campaign') {
				result.objective = insight.objective || 'UNKNOWN';
				result.status = insight.status;
			}

			if (level === 'adset' || level === 'ad') {
				result.campaignId = insight.campaign_id;
				result.campaignName = insight.campaign_name;
			}

			if (level === 'ad') {
				result.adSetId = insight.adset_id;
				result.adSetName = insight.adset_name;
			}

			return result;
		});
	}

	private processBreakdownInsights(
		data: any[],
		breakdown: string,
	): BreakdownMetrics[] {
		return data.map((insight: any) => {
			const metrics = this.calculateMetrics(insight);

			// Extract dimension value based on breakdown type
			let dimensionValue = 'Unknown';
			const breakdownFields = breakdown.split(',');

			if (breakdownFields.length === 1) {
				dimensionValue = insight[breakdown] || 'Unknown';
			} else {
				// For multi-field breakdowns (e.g., platform + position)
				dimensionValue = breakdownFields
					.map((field) => insight[field] || 'Unknown')
					.join(' - ');
			}

			return {
				dimension: breakdown,
				value: dimensionValue,
				...metrics,
			};
		});
	}

	async fetchCampaignsWithDetails(
		store: Store,
		from: Date,
		to: Date,
		limit: number = 100,
	): Promise<InsightMetrics[]> {
		const token = store.fbAdSpendToken;
		const adAccountId = this.normalizeAccountId(store.fbAccountId);

		// First, fetch campaign metadata
		const campaignsUrl = `${this.BASE_URL}/${adAccountId}/campaigns`;
		const campaignsParams = {
			access_token: token,
			fields: 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time',
			limit: 500,
		};

		this.logger.log(`Fetching campaigns metadata for ${store.name}`);
		const campaignsData = await this.callFacebook(
			campaignsUrl,
			campaignsParams,
		);

		if (
			!campaignsData ||
			!campaignsData.data ||
			campaignsData.data.length === 0
		) {
			this.logger.warn(`No campaigns found for ${store.name}`);
			return [];
		}

		const campaigns = campaignsData.data.slice(0, limit);

		// Fetch insights at account level with campaign breakdown
		const insights = (await this.fetchInsights(
			store,
			from,
			to,
			'campaign',
			undefined,
			undefined,
			limit,
		)) as InsightMetrics[];

		// Create a map of campaign metadata
		const campaignMetadataMap = new Map(
			campaigns.map((c: any) => [
				c.id,
				{
					status: c.status,
					objective: c.objective,
					budget:
						parseFloat(c.daily_budget || c.lifetime_budget || '0') /
						100,
					startTime: c.start_time || '',
					endTime: c.stop_time || '',
				},
			]),
		);

		// Merge insights with metadata
		return insights.map((insight) => {
			const metadata = campaignMetadataMap.get(insight.id);
			return {
				...insight,
				...(metadata || {}),
			};
		});
	}

	async fetchAdSetsWithDetails(
		store: Store,
		from: Date,
		to: Date,
		campaignId?: string,
		limit: number = 100,
	): Promise<InsightMetrics[]> {
		const token = store.fbAdSpendToken;
		const adAccountId = this.normalizeAccountId(store.fbAccountId);

		// Fetch adset metadata
		const url = campaignId
			? `${this.BASE_URL}/${campaignId}/adsets`
			: `${this.BASE_URL}/${adAccountId}/adsets`;

		const params = {
			access_token: token,
			fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,start_time,end_time',
			limit: 500,
		};

		this.logger.log(
			`Fetching ad sets metadata for ${store.name}${campaignId ? ` (campaign: ${campaignId})` : ''}`,
		);

		const adSetsData = await this.callFacebook(url, params);

		if (!adSetsData || !adSetsData.data || adSetsData.data.length === 0) {
			this.logger.warn(`No ad sets found for ${store.name}`);
			return [];
		}

		const adSets = adSetsData.data.slice(0, limit);

		// Fetch insights
		const insights = (await this.fetchInsights(
			store,
			from,
			to,
			'adset',
			undefined,
			campaignId,
			limit,
		)) as InsightMetrics[];

		// Create metadata map
		const adSetMetadataMap = new Map(
			adSets.map((a: any) => [
				a.id,
				{
					status: a.status,
					budget:
						parseFloat(a.daily_budget || a.lifetime_budget || '0') /
						100,
					startTime: a.start_time || '',
					endTime: a.end_time || '',
				},
			]),
		);

		return insights.map((insight) => {
			const metadata = adSetMetadataMap.get(insight.id);
			return {
				...insight,
				...(metadata || {}),
			};
		});
	}

	async fetchAdsWithDetails(
		store: Store,
		from: Date,
		to: Date,
		adSetId?: string,
		limit: number = 100,
	): Promise<InsightMetrics[]> {
		const token = store.fbAdSpendToken;
		const adAccountId = this.normalizeAccountId(store.fbAccountId);

		// Fetch ads metadata
		const url = adSetId
			? `${this.BASE_URL}/${adSetId}/ads`
			: `${this.BASE_URL}/${adAccountId}/ads`;

		const params = {
			access_token: token,
			fields: 'id,name,status,adset_id,campaign_id',
			limit: 500,
		};

		this.logger.log(
			`Fetching ads metadata for ${store.name}${adSetId ? ` (ad set: ${adSetId})` : ''}`,
		);

		const adsData = await this.callFacebook(url, params);

		if (!adsData || !adsData.data || adsData.data.length === 0) {
			this.logger.warn(`No ads found for ${store.name}`);
			return [];
		}

		const ads = adsData.data.slice(0, limit);

		// Fetch insights
		const insights = (await this.fetchInsights(
			store,
			from,
			to,
			'ad',
			undefined,
			adSetId,
			limit,
		)) as InsightMetrics[];

		// Create metadata map
		const adMetadataMap = new Map(
			ads.map((a: any) => [
				a.id,
				{
					status: a.status,
				},
			]),
		);

		return insights.map((insight) => {
			const metadata = adMetadataMap.get(insight.id);
			return {
				...insight,
				...(metadata || {}),
			};
		});
	}
}

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditStatus } from '../audit/schemas/audit-log.schema';

export interface RevenueForecast {
	predictions: Array<{
		date: string;
		predicted_revenue: number;
		lower_bound: number;
		upper_bound: number;
	}>;
	model_metrics: {
		mae: number;
		mape: number;
		r2_score: number;
	};
	actionables: string[];
	confidence: string;
	data_quality: {
		total_days: number;
		zero_revenue_days: number;
		zero_percentage: number;
		max_consecutive_zeros: number;
		coefficient_variation: number;
		revenue_stats: {
			mean: number;
			median: number;
			std: number;
			min: number;
			max: number;
		};
	};
}

export interface BudgetOptimization {
	optimal_allocation: {
		facebook: number;
		google: number;
	};
	expected_roi: number;
	channel_performance: {
		facebook: {
			roi_per_rupee: number;
			avg_daily_spend: number;
			recommended_allocation_pct: number;
		};
		google: {
			roi_per_rupee: number;
			avg_daily_spend: number;
			recommended_allocation_pct: number;
		};
	};
	actionables: string[];
	optimization_mode: string;
}

@Injectable()
export class PredictionsService {
	private readonly logger = new Logger(PredictionsService.name);
	private readonly mlServiceUrl: string;
	private readonly maxRetries = 3;
	private readonly retryDelay = 1000; // 1 second

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
		private readonly auditService: AuditService,
	) {
		this.mlServiceUrl =
			this.configService.get<string>('ML_SERVICE_URL') ||
			'http://localhost:8000';

		this.logger.log(`ML Service URL: ${this.mlServiceUrl}`);
	}

	// Get revenue forecast from ML service
	async getRevenueForecast(
		storeId: string,
		forecastDays: number = 30,
	): Promise<RevenueForecast> {
		const startTime = Date.now();

		try {
			this.logger.log(
				`Requesting revenue forecast for store ${storeId} (${forecastDays} days)`,
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId,
				metadata: {
					type: 'revenue_forecast',
					forecastDays,
				},
			});

			const response = await this.makeRequest<RevenueForecast>(
				'POST',
				'/predict/revenue-forecast',
				{
					store_id: storeId,
					forecast_days: forecastDays,
				},
			);

			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_STARTED,
				status: AuditStatus.SUCCESS,
				storeId,
				duration: Date.now() - startTime,
				metadata: {
					type: 'revenue_forecast',
					predictionsGenerated: response.predictions.length,
					confidence: response.confidence,
				},
			});

			this.logger.log(
				`✓ Revenue forecast completed for store ${storeId}`,
			);

			return response;
		} catch (error) {
			await this.auditService.log({
				action: AuditAction.SHOPIFY_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId,
				errorMessage: (error as any).message,
				duration: Date.now() - startTime,
			});

			this.logger.error(
				`Revenue forecast failed: ${(error as any).message}`,
			);
			throw this.handleMLServiceError(error as AxiosError);
		}
	}

	// Optimize ad budget allocation
	async optimizeBudget(
		storeId: string,
		totalBudget: number,
		historicalDays: number = 90,
	): Promise<BudgetOptimization> {
		const startTime = Date.now();

		try {
			this.logger.log(
				`Requesting budget optimization for store ${storeId} ($${totalBudget})`,
			);

			try {
				const channelStatus = await this.checkChannelStatus(
					storeId,
					historicalDays,
				);
				this.logger.log(
					`Channel status: FB=${channelStatus.facebook.status}, Google=${channelStatus.google.status}`,
				);
			} catch (err) {
				this.logger.warn('Could not check channel status');
			}

			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_STARTED,
				status: AuditStatus.PENDING,
				storeId,
				metadata: {
					type: 'budget_optimization',
					totalBudget,
					historicalDays,
				},
			});

			const response = await this.makeRequest<BudgetOptimization>(
				'POST',
				'/optimize/ad-budget',
				{
					store_id: storeId,
					total_budget: totalBudget,
					historical_days: historicalDays,
				},
			);

			await this.auditService.log({
				action: AuditAction.FACEBOOK_INSIGHTS_FETCHED,
				status: AuditStatus.SUCCESS,
				storeId,
				duration: Date.now() - startTime,
				metadata: {
					type: 'budget_optimization',
					facebook_allocation: response.optimal_allocation.facebook,
					google_allocation: response.optimal_allocation.google,
					expected_roi: response.expected_roi,
					optimization_mode: response.optimization_mode,
				},
			});

			this.logger.log(
				`✓ Budget optimization completed for store ${storeId}`,
			);

			return response;
		} catch (error) {
			await this.auditService.log({
				action: AuditAction.FACEBOOK_SYNC_FAILED,
				status: AuditStatus.FAILURE,
				storeId,
				errorMessage: (error as any).message,
				duration: Date.now() - startTime,
			});

			this.logger.error(
				`Budget optimization failed: ${(error as any).message}`,
			);
			throw this.handleMLServiceError(error as AxiosError);
		}
	}

	// Make HTTP request to ML service with retry logic
	private async makeRequest<T>(
		method: 'GET' | 'POST',
		endpoint: string,
		data?: any,
		retryCount: number = 0,
	): Promise<T> {
		try {
			const url = `${this.mlServiceUrl}${endpoint}`;

			const response =
				method === 'GET'
					? await this.httpService.get(url).toPromise()
					: await this.httpService.post(url, data).toPromise();

			if (!response || !response.data) {
				throw new Error('Empty response from ML service');
			}

			return response.data as T;
		} catch (error) {
			const axiosError = error as AxiosError;

			// Retry on network errors or 5xx status codes
			if (retryCount < this.maxRetries) {
				const shouldRetry =
					!axiosError.response ||
					(axiosError.response.status >= 500 &&
						axiosError.response.status < 600);

				if (shouldRetry) {
					this.logger.warn(
						`Request failed, retrying (${retryCount + 1}/${this.maxRetries})...`,
					);

					// Exponential backoff
					await this.sleep(this.retryDelay * Math.pow(2, retryCount));

					return this.makeRequest<T>(
						method,
						endpoint,
						data,
						retryCount + 1,
					);
				}
			}

			throw error;
		}
	}

	// Handle ML service errors and convert to appropriate HTTP exceptions
	private handleMLServiceError(error: AxiosError): HttpException {
		if (!error.response) {
			// Network error - service unavailable
			return new HttpException(
				'ML service is currently unavailable. Please try again later.',
				HttpStatus.SERVICE_UNAVAILABLE,
			);
		}

		const status = error.response.status;
		const data = error.response.data as any;
		const message = data?.detail || error.message;

		if (status === 400) {
			// Bad request - usually insufficient data
			return new HttpException(
				message || 'Insufficient data for prediction',
				HttpStatus.BAD_REQUEST,
			);
		}

		if (status === 404) {
			return new HttpException(
				'Store metrics not found',
				HttpStatus.NOT_FOUND,
			);
		}

		if (status === 500) {
			return new HttpException(
				'ML service internal error',
				HttpStatus.INTERNAL_SERVER_ERROR,
			);
		}

		// Default error
		return new HttpException(
			message || 'Prediction service error',
			HttpStatus.SERVICE_UNAVAILABLE,
		);
	}

	// Health check for ML service
	async checkMLServiceHealth(): Promise<{
		status: string;
		available: boolean;
	}> {
		try {
			const response = await this.httpService
				.get(`${this.mlServiceUrl}/health`)
				.toPromise();

			return {
				status: response?.data?.status || 'unknown',
				available: true,
			};
		} catch (error) {
			this.logger.error('ML service health check failed');
			return {
				status: 'unavailable',
				available: false,
			};
		}
	}

	// Check data quality before predictions
	async checkDataQuality(storeId: string, days: number = 365): Promise<any> {
		try {
			this.logger.log(
				`Checking data quality for store ${storeId} (${days} days)`,
			);

			const response = await this.makeRequest<any>(
				'GET',
				`/diagnose/data-quality/${storeId}?days=${days}`,
			);

			return response;
		} catch (error) {
			this.logger.error(
				`Data quality check failed: ${(error as any).message}`,
			);
			throw this.handleMLServiceError(error as AxiosError);
		}
	}

	// Check which ad channels have data
	async checkChannelStatus(storeId: string, days: number = 90): Promise<any> {
		try {
			this.logger.log(
				`Checking channel status for store ${storeId} (${days} days)`,
			);

			const response = await this.makeRequest<any>(
				'GET',
				`/diagnose/channel-status/${storeId}?days=${days}`,
			);

			return response;
		} catch (error) {
			this.logger.error(
				`Channel status check failed: ${(error as any).message}`,
			);
			throw this.handleMLServiceError(error as AxiosError);
		}
	}

	// Utility: Sleep for specified milliseconds
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

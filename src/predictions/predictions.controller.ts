import {
	Controller,
	Get,
	Post,
	Param,
	Query,
	Body,
	UseGuards,
	Logger,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiParam,
	ApiQuery,
	ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StoreAccessGuard } from '../auth/guards/store-access.guard';
import { PredictionsService } from './predictions.service';
import { StoresService } from '../stores/stores.service';

@ApiTags('ML Predictions')
@ApiBearerAuth('JWT-auth')
@Controller('predictions')
@UseGuards(JwtAuthGuard, RolesGuard, StoreAccessGuard)
export class PredictionsController {
	private readonly logger = new Logger(PredictionsController.name);

	constructor(
		private readonly predictionsService: PredictionsService,
		private readonly storesService: StoresService,
	) {}

	@Get('stores/:storeId/revenue-forecast')
	@ApiOperation({
		summary: 'Get revenue forecast for next 7-90 days',
		description:
			'Uses Prophet time series model to predict future revenue with confidence intervals',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'days',
		required: false,
		type: Number,
		description: 'Number of days to forecast (default: 30)',
	})
	@ApiResponse({
		status: 200,
		description: 'Revenue forecast generated successfully',
		schema: {
			type: 'object',
			properties: {
				storeId: { type: 'string' },
				storeName: { type: 'string' },
				forecastPeriod: { type: 'string' },
				forecast: {
					type: 'object',
					properties: {
						predictions: { type: 'array' },
						model_metrics: { type: 'object' },
						actionables: { type: 'array' },
						confidence: { type: 'string' },
						data_quality: { type: 'object' },
					},
				},
			},
		},
	})
	@ApiResponse({ status: 404, description: 'Store not found' })
	@ApiResponse({
		status: 503,
		description: 'ML service unavailable or insufficient data',
	})
	async getRevenueForecast(
		@Param('storeId') storeId: string,
		@Query('days') days?: number,
	) {
		try {
			const store = await this.storesService.findOne(storeId);
			const forecastDays = days && days > 0 ? Math.min(days, 90) : 30;

			this.logger.log(
				`Generating ${forecastDays}-day revenue forecast for ${store.name}`,
			);

			const forecast = await this.predictionsService.getRevenueForecast(
				storeId,
				forecastDays,
			);

			return {
				storeId: store._id,
				storeName: store.name,
				forecastPeriod: `${forecastDays} days`,
				forecast,
			};
		} catch (error) {
			this.logger.error(
				`Revenue forecast error: ${(error as any).message}`,
			);
			throw new HttpException(
				(error as any).message || 'Forecast generation failed',
				(error as any).status || HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
	}

	@Post('stores/:storeId/optimize-budget')
	@ApiOperation({
		summary: 'Optimize ad budget allocation',
		description:
			'Analyzes historical performance to recommend optimal Facebook/Google budget split',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiBody({
		schema: {
			type: 'object',
			properties: {
				totalBudget: {
					type: 'number',
					example: 10000,
					description: 'Total budget to allocate (USD)',
				},
				historicalDays: {
					type: 'number',
					example: 90,
					description:
						'Days of historical data to analyze (default: 90)',
				},
			},
			required: ['totalBudget'],
		},
	})
	@ApiResponse({
		status: 200,
		description: 'Budget optimization completed',
		schema: {
			type: 'object',
			properties: {
				storeId: { type: 'string' },
				storeName: { type: 'string' },
				totalBudget: { type: 'number' },
				optimization: {
					type: 'object',
					properties: {
						optimal_allocation: { type: 'object' },
						expected_roi: { type: 'number' },
						channel_performance: { type: 'object' },
						actionables: { type: 'array' },
						optimization_mode: { type: 'string' },
					},
				},
			},
		},
	})
	@ApiResponse({ status: 404, description: 'Store not found' })
	async optimizeBudget(
		@Param('storeId') storeId: string,
		@Body('totalBudget') totalBudget: number,
		@Body('historicalDays') historicalDays?: number,
	) {
		try {
			if (!totalBudget || totalBudget <= 0) {
				throw new HttpException(
					'Total budget must be greater than 0',
					HttpStatus.BAD_REQUEST,
				);
			}

			const store = await this.storesService.findOne(storeId);

			this.logger.log(
				`Optimizing $${totalBudget} budget allocation for ${store.name}`,
			);

			const optimization = await this.predictionsService.optimizeBudget(
				storeId,
				totalBudget,
				historicalDays || 90,
			);

			return {
				storeId: store._id,
				storeName: store.name,
				totalBudget,
				optimization,
			};
		} catch (error) {
			this.logger.error(
				`Budget optimization error: ${(error as any).message}`,
			);
			throw new HttpException(
				(error as any).message || 'Optimization failed',
				(error as any).status || HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
	}

	@Get('stores/:storeId/insights')
	@ApiOperation({
		summary: 'Get comprehensive actionable insights',
		description:
			'Aggregates all predictions and analysis into prioritized recommendations',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'forecastDays',
		required: false,
		type: Number,
		description: 'Days to forecast (default: 7)',
	})
	@ApiResponse({
		status: 200,
		description: 'Insights generated successfully',
	})
	async getComprehensiveInsights(
		@Param('storeId') storeId: string,
		@Query('forecastDays') forecastDays?: number,
	) {
		try {
			const store = await this.storesService.findOne(storeId);
			const days = forecastDays || 7;

			this.logger.log(
				`Generating comprehensive insights for ${store.name}`,
			);

			// Fetch all predictions in parallel
			const [revenueForecast, budgetOptimization] = await Promise.all([
				this.predictionsService
					.getRevenueForecast(storeId, days)
					.catch((err) => {
						this.logger.warn(
							`Revenue forecast failed: ${err.message}`,
						);
						return null;
					}),
				this.predictionsService
					.optimizeBudget(storeId, 10000, 90)
					.catch((err) => {
						this.logger.warn(
							`Budget optimization failed: ${err.message}`,
						);
						return null;
					}),
			]);

			// Aggregate actionables
			const allActionables: string[] = [];

			if (revenueForecast) {
				allActionables.push(...revenueForecast.actionables);
			}

			if (budgetOptimization) {
				allActionables.push(...budgetOptimization.actionables);
			}

			// Prioritize actionables
			const prioritizedActions = this.prioritizeActions(allActionables);

			return {
				storeId: store._id,
				storeName: store.name,
				timestamp: new Date().toISOString(),
				summary: this.generateSummary(
					revenueForecast,
					budgetOptimization,
				),
				insights: {
					revenue: revenueForecast
						? {
								predictions: revenueForecast.predictions.slice(
									0,
									7,
								),
								confidence: revenueForecast.confidence,
								actionables: revenueForecast.actionables,
								data_quality: revenueForecast.data_quality,
							}
						: null,
					budget: budgetOptimization
						? {
								optimal_allocation:
									budgetOptimization.optimal_allocation,
								expected_roi: budgetOptimization.expected_roi,
								actionables: budgetOptimization.actionables,
								optimization_mode:
									budgetOptimization.optimization_mode,
							}
						: null,
				},
				priorityActions: prioritizedActions,
			};
		} catch (error) {
			this.logger.error(
				`Insights generation error: ${(error as any).message}`,
			);
			throw new HttpException(
				(error as any).message || 'Insights generation failed',
				(error as any).status || HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
	}

	@Get('stores/:storeId/data-quality')
	@ApiOperation({
		summary: 'Check data quality for predictions',
		description:
			'Analyzes historical data quality and suitability for ML predictions',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'days',
		required: false,
		type: Number,
		description: 'Days of data to analyze (default: 365)',
	})
	@ApiResponse({
		status: 200,
		description: 'Data quality report generated',
	})
	async checkDataQuality(
		@Param('storeId') storeId: string,
		@Query('days') days?: number,
	) {
		try {
			const store = await this.storesService.findOne(storeId);
			const analysisDays = days || 365;

			this.logger.log(
				`Checking data quality for ${store.name} (${analysisDays} days)`,
			);

			const dataQuality = await this.predictionsService.checkDataQuality(
				storeId,
				analysisDays,
			);

			return {
				storeId: store._id,
				storeName: store.name,
				analysisPeriod: `${analysisDays} days`,
				dataQuality,
			};
		} catch (error) {
			this.logger.error(
				`Data quality check error: ${(error as any).message}`,
			);
			throw new HttpException(
				(error as any).message || 'Data quality check failed',
				(error as any).status || HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
	}

	@Get('stores/:storeId/channel-status')
	@ApiOperation({
		summary: 'Check ad channel data availability',
		description:
			'Shows which ad channels (Facebook/Google) have active spending data',
	})
	@ApiParam({ name: 'storeId', description: 'Store ID' })
	@ApiQuery({
		name: 'days',
		required: false,
		type: Number,
		description: 'Days to analyze (default: 90)',
	})
	@ApiResponse({
		status: 200,
		description: 'Channel status retrieved',
	})
	async checkChannelStatus(
		@Param('storeId') storeId: string,
		@Query('days') days?: number,
	) {
		try {
			const store = await this.storesService.findOne(storeId);
			const analysisDays = days || 90;

			this.logger.log(
				`Checking channel status for ${store.name} (${analysisDays} days)`,
			);

			const channelStatus =
				await this.predictionsService.checkChannelStatus(
					storeId,
					analysisDays,
				);

			return {
				storeId: store._id,
				storeName: store.name,
				analysisPeriod: `${analysisDays} days`,
				channels: channelStatus,
			};
		} catch (error) {
			this.logger.error(
				`Channel status check error: ${(error as any).message}`,
			);
			throw new HttpException(
				(error as any).message || 'Channel status check failed',
				(error as any).status || HttpStatus.SERVICE_UNAVAILABLE,
			);
		}
	}

	private prioritizeActions(actionables: string[]): string[] {
		// Priority keywords
		const highPriority = ['trending up', 'increase', 'higher roi'];
		const mediumPriority = ['review', 'consider', 'monitor'];
		const lowPriority = ['stable', 'maintain'];

		const categorized = {
			high: [] as string[],
			medium: [] as string[],
			low: [] as string[],
		};

		actionables.forEach((action) => {
			const lowerAction = action.toLowerCase();
			if (highPriority.some((keyword) => lowerAction.includes(keyword))) {
				categorized.high.push(action);
			} else if (
				mediumPriority.some((keyword) => lowerAction.includes(keyword))
			) {
				categorized.medium.push(action);
			} else {
				categorized.low.push(action);
			}
		});

		return [...categorized.high, ...categorized.medium, ...categorized.low];
	}

	private generateSummary(
		revenueForecast: any,
		budgetOptimization: any,
	): string {
		const parts: string[] = [];

		if (revenueForecast) {
			const trend = revenueForecast.actionables[0] || '';
			if (trend.includes('UP')) {
				parts.push('Revenue trending upward');
			} else if (trend.includes('DOWN')) {
				parts.push('Revenue trending downward');
			} else {
				parts.push('Revenue stable');
			}
		}

		if (budgetOptimization) {
			const fbAlloc =
				budgetOptimization.channel_performance.facebook
					.recommended_allocation_pct;
			const googleAlloc =
				budgetOptimization.channel_performance.google
					.recommended_allocation_pct;

			if (Math.abs(fbAlloc - googleAlloc) < 10) {
				parts.push('channels performing similarly');
			} else if (fbAlloc > googleAlloc) {
				parts.push('Facebook outperforming Google');
			} else {
				parts.push('Google outperforming Facebook');
			}
		}

		if (budgetOptimization?.optimization_mode === 'single_channel') {
			const activeChannel =
				budgetOptimization.optimal_allocation.facebook > 0
					? 'Facebook'
					: 'Google';
			parts.push(
				`using ${activeChannel} only (single-channel optimization)`,
			);
		}

		return parts.join(', ') || 'Analysis complete';
	}
}

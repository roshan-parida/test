import {
	Controller,
	Post,
	Body,
	Get,
	UseGuards,
	Req,
	Query,
	Param,
} from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
	ApiQuery,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AcceptInvitationDto } from '../users/dto/accept-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('signup')
	@ApiOperation({
		summary: 'Register new user (sends OTP to email)',
		description:
			'Submit registration details. User data is stored temporarily and OTP is sent via email. After OTP verification, account is created automatically.',
	})
	@ApiResponse({
		status: 201,
		description: 'OTP sent successfully to email',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example:
						'OTP sent to your email. Please verify to complete registration.',
				},
				email: { type: 'string', example: 'user@example.com' },
				expiresIn: { type: 'string', example: '10 minutes' },
			},
		},
	})
	@ApiResponse({
		status: 409,
		description: 'Email or store name already in use',
	})
	async signup(@Body() dto: SignupDto) {
		return this.authService.signup(dto);
	}

	@Post('verify-otp')
	@ApiOperation({
		summary: 'Verify OTP and create account',
		description:
			'Verify the OTP sent to email. On success, account is created automatically and welcome email with auto-login link is sent.',
	})
	@ApiResponse({
		status: 200,
		description:
			'OTP verified, account created, and welcome email sent with auto-login link',
		schema: {
			type: 'object',
			properties: {
				user: { type: 'object' },
				token: { type: 'string' },
				message: {
					type: 'string',
					example:
						'Email verified successfully! Account created. Check your email for login link.',
				},
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
	async verifyOtp(@Body() dto: VerifyOtpDto) {
		return this.authService.verifyOtp(dto);
	}

	@Post('resend-otp')
	@ApiOperation({
		summary: 'Resend OTP to email',
		description:
			'Request a new OTP if the previous one expired or was not received',
	})
	@ApiResponse({
		status: 200,
		description: 'New OTP sent successfully',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'New OTP sent to your email',
				},
				email: { type: 'string', example: 'user@example.com' },
				expiresIn: { type: 'string', example: '10 minutes' },
			},
		},
	})
	@ApiResponse({ status: 409, description: 'Email already registered' })
	async resendOtp(@Body() dto: ResendOtpDto) {
		return this.authService.resendOtp(dto);
	}

	@Post('login')
	@ApiOperation({ summary: 'Login with email and password' })
	@ApiResponse({ status: 200, description: 'Successfully authenticated' })
	@ApiResponse({ status: 401, description: 'Invalid credentials' })
	async login(@Body() dto: LoginDto) {
		return this.authService.login(dto);
	}

	@Get('auto-login')
	@ApiOperation({
		summary: 'Auto-login with token from email',
		description:
			'Used by the welcome email link to automatically log users in. Token is valid for 24 hours.',
	})
	@ApiQuery({
		name: 'token',
		required: true,
		description: 'JWT token from welcome email',
	})
	@ApiResponse({
		status: 200,
		description: 'Successfully authenticated via auto-login',
		schema: {
			type: 'object',
			properties: {
				user: { type: 'object' },
				token: { type: 'string' },
			},
		},
	})
	@ApiResponse({ status: 401, description: 'Invalid or expired token' })
	async autoLogin(@Query('token') token: string) {
		return this.authService.autoLogin(token);
	}

	@Post('forgot-password')
	@ApiOperation({
		summary: 'Request password reset OTP',
		description: 'Send OTP to user email for password reset',
	})
	@ApiResponse({
		status: 200,
		description: 'Password reset OTP sent to email',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'Password reset OTP sent to your email',
				},
				email: { type: 'string', example: 'user@example.com' },
				expiresIn: { type: 'string', example: '10 minutes' },
			},
		},
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async forgotPassword(@Body() dto: ForgotPasswordDto) {
		return this.authService.forgotPassword(dto);
	}

	@Post('reset-password')
	@ApiOperation({
		summary: 'Reset password with OTP',
		description: 'Verify OTP and set new password',
	})
	@ApiResponse({
		status: 200,
		description: 'Password reset successfully',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'Password reset successfully',
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Invalid or expired OTP',
	})
	@ApiResponse({
		status: 404,
		description: 'User not found',
	})
	async resetPassword(@Body() dto: ResetPasswordDto) {
		return this.authService.resetPassword(dto);
	}

	@Post('change-password')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({
		summary: 'Change password for logged-in user',
		description: 'User must provide current password to set a new password',
	})
	@ApiResponse({
		status: 200,
		description: 'Password changed successfully',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example: 'Password changed successfully',
				},
			},
		},
	})
	@ApiResponse({
		status: 401,
		description: 'Current password is incorrect',
	})
	async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
		return this.authService.changePassword(req.user.userId, dto);
	}

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({ summary: 'Get current user profile' })
	@ApiResponse({ status: 200, description: 'User profile retrieved' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async me(@Req() req: any) {
		return this.authService.getProfile(req.user.userId);
	}

	@Get('invitation/:token')
	@ApiOperation({ summary: 'Get invitation details by token' })
	@ApiResponse({
		status: 200,
		description: 'Invitation details retrieved',
		schema: {
			type: 'object',
			properties: {
				email: { type: 'string' },
				storeName: { type: 'string' },
				invitedBy: { type: 'string' },
				expiresAt: { type: 'string' },
			},
		},
	})
	@ApiResponse({
		status: 404,
		description: 'Invitation not found or expired',
	})
	async getInvitation(@Param('token') token: string) {
		const invitation = (await this.authService.getInvitationDetails(
			token,
		)) as any;
		return {
			email: invitation.email,
			storeName: invitation.storeName,
			invitedBy: (invitation.invitedBy as any).name,
			expiresAt: invitation.expiresAt,
		};
	}

	@Post('accept-invitation/:token')
	@ApiOperation({ summary: 'Accept invitation and create viewer account' })
	@ApiResponse({
		status: 201,
		description: 'Account created successfully',
		schema: {
			type: 'object',
			properties: {
				user: { type: 'object' },
				token: { type: 'string' },
				message: { type: 'string' },
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Invalid or expired invitation' })
	@ApiResponse({ status: 409, description: 'Email already registered' })
	async acceptInvitation(
		@Param('token') token: string,
		@Body() dto: AcceptInvitationDto,
	) {
		return this.authService.acceptInvitation(token, dto);
	}
}

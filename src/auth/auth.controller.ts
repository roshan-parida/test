import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import {
	ApiTags,
	ApiOperation,
	ApiResponse,
	ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('signup')
	@ApiOperation({
		summary: 'Initiate user registration (sends OTP to email)',
		description:
			'Send user details to receive an OTP via email for verification',
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
		summary: 'Verify email with OTP',
		description: 'Verify the OTP sent to your email',
	})
	@ApiResponse({
		status: 200,
		description: 'Email verified successfully',
		schema: {
			type: 'object',
			properties: {
				message: {
					type: 'string',
					example:
						'Email verified successfully. You can now complete your registration.',
				},
				email: { type: 'string', example: 'user@example.com' },
			},
		},
	})
	@ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
	async verifyOtp(@Body() dto: VerifyOtpDto) {
		return this.authService.verifyOtp(dto);
	}

	@Post('complete-signup')
	@ApiOperation({
		summary: 'Complete registration after OTP verification',
		description:
			'Complete account creation after successful OTP verification and sends welcome email.',
	})
	@ApiResponse({
		status: 201,
		description: 'User successfully registered and welcome email sent',
		schema: {
			type: 'object',
			properties: {
				user: { type: 'object' },
				token: { type: 'string' },
				message: {
					type: 'string',
					example:
						'Account created successfully. Welcome to Ad Matrix!',
				},
			},
		},
	})
	@ApiResponse({
		status: 400,
		description: 'Email not verified or already registered',
	})
	async completeSignup(@Body() dto: SignupDto) {
		return this.authService.completeSignup(dto);
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

	@Get('me')
	@UseGuards(JwtAuthGuard)
	@ApiBearerAuth('JWT-auth')
	@ApiOperation({ summary: 'Get current user profile' })
	@ApiResponse({ status: 200, description: 'User profile retrieved' })
	@ApiResponse({ status: 401, description: 'Unauthorized' })
	async me(@Req() req: any) {
		return this.authService.getProfile(req.user.userId);
	}
}

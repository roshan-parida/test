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
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	@Post('signup')
	@ApiOperation({ summary: 'Register a new user' })
	@ApiResponse({ status: 201, description: 'User successfully registered' })
	@ApiResponse({ status: 409, description: 'Email already in use' })
	async signup(@Body() dto: SignupDto) {
		return this.authService.signup(dto);
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

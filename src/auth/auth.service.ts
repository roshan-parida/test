import {
	Injectable,
	UnauthorizedException,
	ConflictException,
	BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { Otp } from './schemas/otp.schema';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly mailService: MailService,
		@InjectModel(Otp.name)
		private readonly otpModel: Model<Otp>,
	) {}

	private sanitizeUser(user: any) {
		if (!user) return null;
		const obj = user.toObject ? user.toObject() : user;

		const { password, __v, ...rest } = obj;
		return rest;
	}

	private generateOtp(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	async signup(dto: SignupDto) {
		// Check if email already exists
		const existing = await this.usersService.findByEmail(dto.email);
		if (existing) {
			throw new ConflictException('Email already in use');
		}

		// Check if store name already exists
		const existingStoreName = await this.usersService.findByStoreName(
			dto.storeName,
		);
		if (existingStoreName) {
			throw new ConflictException('Store name already in use');
		}

		// Generate OTP
		const otp = this.generateOtp();
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

		await this.otpModel.create({
			email: dto.email,
			otp,
			expiresAt,
			isVerified: false,
		});

		await this.mailService.sendOtpEmail(dto.email, otp, dto.name);

		return {
			message:
				'OTP sent to your email. Please verify to complete registration.',
			email: dto.email,
			expiresIn: '10 minutes',
		};
	}

	async verifyOtp(dto: VerifyOtpDto) {
		const otpRecord = await this.otpModel
			.findOne({
				email: dto.email,
				otp: dto.otp,
				isVerified: false,
			})
			.sort({ createdAt: -1 })
			.exec();

		if (!otpRecord) {
			throw new BadRequestException('Invalid or expired OTP');
		}

		// Check if OTP is expired
		if (new Date() > otpRecord.expiresAt) {
			throw new BadRequestException(
				'OTP has expired. Please request a new one.',
			);
		}

		// Mark OTP as verified
		otpRecord.isVerified = true;
		await otpRecord.save();

		return {
			message:
				'Email verified successfully. You can now complete your registration.',
			email: dto.email,
		};
	}

	async resendOtp(dto: ResendOtpDto) {
		const existingUser = await this.usersService.findByEmail(dto.email);
		if (existingUser) {
			throw new ConflictException(
				'Email already registered and verified',
			);
		}

		// Invalidate previous OTPs
		await this.otpModel.updateMany(
			{ email: dto.email, isVerified: false },
			{ $set: { isVerified: true } },
		);

		const otp = this.generateOtp();
		const expiresAt = new Date();
		expiresAt.setMinutes(expiresAt.getMinutes() + 10);

		await this.otpModel.create({
			email: dto.email,
			otp,
			expiresAt,
			isVerified: false,
		});

		// Note: You'll need to store the user's name somewhere or fetch it
		// For now, using a generic greeting
		await this.mailService.sendOtpEmail(dto.email, otp, 'User');

		return {
			message: 'New OTP sent to your email',
			email: dto.email,
			expiresIn: '10 minutes',
		};
	}

	async completeSignup(dto: SignupDto) {
		const verifiedOtp = await this.otpModel
			.findOne({
				email: dto.email,
				isVerified: true,
			})
			.sort({ createdAt: -1 })
			.exec();

		if (!verifiedOtp) {
			throw new BadRequestException('Please verify your email first');
		}

		const existing = await this.usersService.findByEmail(dto.email);
		if (existing) {
			throw new ConflictException('Email already in use');
		}

		const hashedPassword = await bcrypt.hash(dto.password, 12);

		const user = await this.usersService.create({
			name: dto.name,
			email: dto.email,
			password: hashedPassword,
			role: UserRole.MANAGER,
			storeName: dto.storeName,
			storeUrl: dto.storeUrl,
		});

		await this.mailService.sendWelcomeEmail(dto.email, dto.name);

		const token = await this.signToken(user.id, user.email, user.role, []);

		return {
			user: this.sanitizeUser(user),
			token,
			message: 'Account created successfully. Welcome to Ad Matrix!',
		};
	}

	async login(dto: LoginDto) {
		const user = await this.usersService.findByEmail(dto.email);
		if (!user || !user.isActive) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const passwordValid = await bcrypt.compare(dto.password, user.password);
		if (!passwordValid) {
			throw new UnauthorizedException('Invalid credentials');
		}

		const token = await this.signToken(
			user.id,
			user.email,
			user.role,
			user.assignedStores ?? [],
		);

		return {
			user: this.sanitizeUser(user),
			token,
		};
	}

	async getProfile(userId: string) {
		const user = await this.usersService.findById(userId);
		return this.sanitizeUser(user);
	}

	private async signToken(
		userId: string,
		email: string,
		role: UserRole,
		assignedStores: any[],
	): Promise<string> {
		const payload = {
			sub: userId,
			email,
			role,
			assignedStores: assignedStores.map((id) => id.toString()),
		};

		return this.jwtService.signAsync(payload);
	}
}

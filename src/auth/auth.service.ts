import {
	Injectable,
	UnauthorizedException,
	ConflictException,
	BadRequestException,
	NotFoundException,
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
import { PendingUser } from './schemas/pending-user.schema';
import { AcceptInvitationDto } from '../users/dto/accept-invitation.dto';
import { PasswordReset } from './schemas/password-reset.schema';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditStatus } from '../audit/schemas/audit-log.schema';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
		private readonly mailService: MailService,
		@InjectModel(PendingUser.name)
		private readonly pendingUserModel: Model<PendingUser>,
		private readonly auditService: AuditService,
		@InjectModel(PasswordReset.name)
		private readonly passwordResetModel: Model<PasswordReset>,
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
		// Check if email already exists in actual users
		const existingUser = await this.usersService.findByEmail(dto.email);
		if (existingUser) {
			throw new ConflictException('Email already registered');
		}

		// Check if store name already exists
		const existingStoreName = await this.usersService.findByStoreName(
			dto.storeName,
		);
		if (existingStoreName) {
			throw new ConflictException('Store name already in use');
		}

		// Hash password immediately
		const hashedPassword = await bcrypt.hash(dto.password, 12);

		// Generate OTP
		const otp = this.generateOtp();
		const otpExpiresAt = new Date();
		otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10); // 10 minutes

		// Delete any existing pending user with this email
		await this.pendingUserModel.deleteMany({ email: dto.email });

		// Store pending user with all data
		await this.pendingUserModel.create({
			email: dto.email,
			name: dto.name,
			password: hashedPassword,
			storeName: dto.storeName,
			storeUrl: dto.storeUrl,
			otp,
			otpExpiresAt,
			isVerified: false,
		});

		await this.auditService.log({
			action: AuditAction.USER_SIGNUP,
			status: AuditStatus.SUCCESS,
			userEmail: dto.email,
			metadata: { storeName: dto.storeName },
		});

		// Send OTP email asynchronously (non-blocking)
		this.mailService.sendOtpEmail(dto.email, otp, dto.name).catch((err) => {
			console.error('Failed to send OTP email:', err);
		});

		return {
			message:
				'OTP sent to your email. Please verify to complete registration.',
			email: dto.email,
			expiresIn: '10 minutes',
		};
	}

	async verifyOtp(dto: VerifyOtpDto) {
		// Find pending user with matching OTP
		const pendingUser = await this.pendingUserModel
			.findOne({
				email: dto.email,
				otp: dto.otp,
				isVerified: false,
			})
			.exec();

		if (!pendingUser) {
			throw new BadRequestException('Invalid or expired OTP');
		}

		// Check if OTP is expired
		if (new Date() > pendingUser.otpExpiresAt) {
			throw new BadRequestException(
				'OTP has expired. Please request a new one.',
			);
		}

		// Check again if email was registered in the meantime
		const existingUser = await this.usersService.findByEmail(dto.email);
		if (existingUser) {
			await this.pendingUserModel.deleteOne({ email: dto.email });
			throw new ConflictException('Email already registered');
		}

		// Create the actual user account
		const user = await this.usersService.create({
			name: pendingUser.name,
			email: pendingUser.email,
			password: pendingUser.password, // Already hashed
			role: UserRole.MANAGER,
			storeName: pendingUser.storeName,
			storeUrl: pendingUser.storeUrl,
		});

		await this.auditService.log({
			action: AuditAction.USER_CREATED,
			status: AuditStatus.SUCCESS,
			userId: user.id,
			userEmail: user.email,
			metadata: { storeName: user.storeName, role: user.role },
		});

		// Generate auto-login token
		const token = await this.signToken(user.id, user.email, user.role, []);

		// Send welcome email asynchronously (non-blocking)
		this.mailService
			.sendWelcomeEmail(user.email, user.name, token)
			.catch((err) => {
				console.error('Failed to send welcome email:', err);
			});

		// Delete pending user record
		await this.pendingUserModel.deleteOne({ email: dto.email });

		return {
			user: this.sanitizeUser(user),
			token,
			message:
				'Email verified successfully! Account created. Check your email for login link.',
		};
	}

	async resendOtp(dto: ResendOtpDto) {
		// Check if user already exists
		const existingUser = await this.usersService.findByEmail(dto.email);
		if (existingUser) {
			throw new ConflictException('Email already registered');
		}

		// Find pending user
		const pendingUser = await this.pendingUserModel
			.findOne({ email: dto.email })
			.exec();

		if (!pendingUser) {
			throw new BadRequestException(
				'No pending registration found for this email. Please sign up first.',
			);
		}

		const otp = this.generateOtp();
		const otpExpiresAt = new Date();
		otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10);

		// Update pending user with new OTP
		pendingUser.otp = otp;
		pendingUser.otpExpiresAt = otpExpiresAt;
		await pendingUser.save();

		// Send new OTP email asynchronously (non-blocking)
		this.mailService
			.sendOtpEmail(dto.email, otp, pendingUser.name)
			.catch((err) => {
				console.error('Failed to resend OTP email:', err);
			});

		return {
			message: 'New OTP sent to your email',
			email: dto.email,
			expiresIn: '10 minutes',
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

		await this.auditService.log({
			action: AuditAction.USER_LOGIN,
			status: AuditStatus.SUCCESS,
			userId: user.id,
			userEmail: user.email,
		});

		return {
			user: this.sanitizeUser(user),
			token,
		};
	}

	async getProfile(userId: string) {
		const user = await this.usersService.findById(userId);
		return this.sanitizeUser(user);
	}

	async autoLogin(token: string) {
		try {
			const payload = await this.jwtService.verifyAsync(token);
			const user = await this.usersService.findById(payload.sub);

			return {
				user: this.sanitizeUser(user),
				token,
			};
		} catch (error) {
			throw new UnauthorizedException('Invalid or expired token');
		}
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

	async forgotPassword(dto: ForgotPasswordDto) {
		// Check if user exists
		const user = await this.usersService.findByEmail(dto.email);
		if (!user) {
			throw new NotFoundException('No account found with this email');
		}

		// Check if user is active
		if (!user.isActive) {
			throw new UnauthorizedException('Account is inactive');
		}

		// Generate OTP
		const otp = this.generateOtp();
		const otpExpiresAt = new Date();
		otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 10); // 10 minutes

		// Delete any existing password reset requests for this email
		await this.passwordResetModel.deleteMany({
			email: dto.email,
			isUsed: false,
		});

		// Create new password reset request
		await this.passwordResetModel.create({
			email: dto.email,
			otp,
			otpExpiresAt,
			isUsed: false,
		});

		// Send OTP email asynchronously (non-blocking)
		this.mailService
			.sendPasswordResetOtpEmail(dto.email, otp, user.name)
			.catch((err) => {
				console.error('Failed to send password reset OTP email:', err);
			});

		return {
			message: 'Password reset OTP sent to your email',
			email: dto.email,
			expiresIn: '10 minutes',
		};
	}

	async resetPassword(dto: ResetPasswordDto) {
		const resetRequest = await this.passwordResetModel
			.findOne({
				email: dto.email,
				otp: dto.otp,
				isUsed: false,
			})
			.exec();

		if (!resetRequest) {
			throw new BadRequestException('Invalid or expired OTP');
		}

		// Check if OTP is expired
		if (new Date() > resetRequest.otpExpiresAt) {
			throw new BadRequestException(
				'OTP has expired. Please request a new one.',
			);
		}

		const user = await this.usersService.findByEmail(dto.email);
		if (!user) {
			throw new NotFoundException('User not found');
		}

		const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

		// Update user password
		user.password = hashedPassword;
		await user.save();

		// Mark OTP as used
		resetRequest.isUsed = true;
		await resetRequest.save();

		// Send confirmation email asynchronously (non-blocking)
		this.mailService
			.sendPasswordResetConfirmationEmail(dto.email, user.name)
			.catch((err) => {
				console.error(
					'Failed to send password reset confirmation:',
					err,
				);
			});

		return {
			message:
				'Password reset successfully. You can now login with your new password.',
		};
	}

	async changePassword(userId: string, dto: ChangePasswordDto) {
		const user = await this.usersService.findById(userId);
		if (!user) {
			throw new NotFoundException('User not found');
		}

		const isPasswordValid = await bcrypt.compare(
			dto.currentPassword,
			user.password,
		);
		if (!isPasswordValid) {
			throw new UnauthorizedException('Current password is incorrect');
		}

		// Check if new password is same as current password
		const isSamePassword = await bcrypt.compare(
			dto.newPassword,
			user.password,
		);
		if (isSamePassword) {
			throw new BadRequestException(
				'New password must be different from current password',
			);
		}

		const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

		// Update user password
		user.password = hashedPassword;
		await user.save();

		// Send confirmation email asynchronously (non-blocking)
		this.mailService
			.sendPasswordChangeConfirmationEmail(user.email, user.name)
			.catch((err) => {
				console.error(
					'Failed to send password change confirmation:',
					err,
				);
			});

		return {
			message: 'Password changed successfully',
		};
	}

	async getInvitationDetails(token: string) {
		const invitation = await this.usersService.findInvitationByToken(token);

		if (!invitation) {
			throw new BadRequestException('Invitation not found or expired');
		}

		if (new Date() > invitation.expiresAt) {
			throw new BadRequestException('Invitation has expired');
		}

		return invitation;
	}

	async acceptInvitation(token: string, dto: AcceptInvitationDto) {
		const invitation = await this.getInvitationDetails(token);

		const existingUser = await this.usersService.findByEmail(
			invitation.email,
		);
		if (existingUser) {
			throw new ConflictException('Email already registered');
		}

		const hashedPassword = await bcrypt.hash(dto.password, 12);

		const user = await this.usersService.create({
			name: dto.name,
			email: invitation.email,
			password: hashedPassword,
			role: UserRole.VIEWER,
			storeName: invitation.storeName,
			storeUrl: invitation.storeUrl,
		});

		await this.auditService.log({
			action: AuditAction.INVITATION_ACCEPTED,
			status: AuditStatus.SUCCESS,
			userId: user._id.toString(),
			userEmail: user.email,
			metadata: { invitationToken: token },
		});

		const storeIds = invitation.assignedStores.map((s) => s.toString());
		await this.usersService.assignStores(user._id.toString(), storeIds);

		// Mark invitation as accepted
		await this.usersService.acceptInvitation(token);

		const jwtToken = await this.signToken(
			user._id.toString(),
			user.email,
			user.role,
			storeIds,
		);

		// Send welcome email to viewer asynchronously (non-blocking)
		this.mailService
			.sendViewerWelcomeEmail(user.email, user.name, jwtToken)
			.catch((err) => {
				console.error('Failed to send viewer welcome email:', err);
			});

		return {
			user: this.sanitizeUser(user),
			token: jwtToken,
			message:
				'Account created successfully! You can now access your assigned stores. Check your email for login link.',
		};
	}
}

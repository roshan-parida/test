import {
	Injectable,
	UnauthorizedException,
	ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly jwtService: JwtService,
	) {}

	private sanitizeUser(user: any) {
		if (!user) return null;
		const obj = user.toObject ? user.toObject() : user;

		const { password, __v, ...rest } = obj;
		return rest;
	}

	async signup(dto: SignupDto) {
		const existing = await this.usersService.findByEmail(dto.email);
		if (existing) {
			throw new ConflictException('Email already in use');
		}

		const hashedPassword = await bcrypt.hash(dto.password, 12);
		const role = dto.role ?? UserRole.VIEWER;

		const user = await this.usersService.create({
			email: dto.email,
			password: hashedPassword,
			role,
		});

		// include assignedStores in the token
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

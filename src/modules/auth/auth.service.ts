import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hash password bằng Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MiB
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Verify password với Argon2id
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Đăng ký tài khoản mới
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, fullName } = registerDto;

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Tạo user mới
    const user = await this.usersService.create(email, hashedPassword, fullName);

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Lưu refresh token (đã hash)
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Đăng nhập
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Tìm user
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(user.password, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Lưu refresh token (đã hash)
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  /**
   * Đăng xuất
   */
  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<Omit<AuthResponseDto, 'user'>> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    // Verify refresh token
    const isRefreshTokenValid = await this.verifyPassword(
      user.refreshToken,
      refreshToken,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Access Denied');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user);

    // Update refresh token
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Generate access & refresh tokens
   */
  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtSecret = this.configService.get<string>('JWT_SECRET') || 'secret';
    const jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret';
    const jwtRefreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any, {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn,
      } as any),
      this.jwtService.signAsync(
        { sub: user.id, email: user.email } as any,
        {
          secret: jwtRefreshSecret,
          expiresIn: jwtRefreshExpiresIn,
        } as any,
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Update refresh token trong database (hash trước khi lưu)
   */
  private async updateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hashedRefreshToken = await this.hashPassword(refreshToken);
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);
  }

  /**
   * Lấy thông tin user hiện tại
   */
  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}

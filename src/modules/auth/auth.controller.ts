import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Res,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Đăng ký tài khoản mới',
    description: 'Tạo tài khoản mới với email, password và họ tên',
  })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(registerDto);

    // Set cookies cho web client (httpOnly, secure)
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập',
    description: 'Đăng nhập bằng email và password',
  })
  @ApiResponse({
    status: 200,
    description: 'Đăng nhập thành công',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(loginDto);

    // Set cookies cho web client
    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Đăng xuất',
    description: 'Đăng xuất và xóa refresh token',
  })
  @ApiResponse({ status: 200, description: 'Đăng xuất thành công' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.userId);

    // Clear cookies
    this.clearAuthCookies(res);

    return { message: 'Đăng xuất thành công' };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Làm mới access token',
    description:
      'Sử dụng refresh token để lấy access token mới. Hỗ trợ cả Bearer token (mobile) và cookie (web)',
  })
  @ApiBearerAuth('JWT')
  @ApiResponse({
    status: 200,
    description: 'Làm mới token thành công',
    schema: {
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token không hợp lệ' })
  async refresh(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokens = await this.authService.refreshTokens(
      user.userId,
      user.refreshToken,
    );

    // Set cookies cho web client
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return tokens;
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Lấy thông tin người dùng hiện tại',
    description: 'Lấy thông tin profile của user đang đăng nhập',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin thành công',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập' })
  async getCurrentUser(@CurrentUser() user: any): Promise<UserResponseDto> {
    const currentUser = await this.authService.getCurrentUser(user.userId);

    return {
      id: currentUser.id,
      email: currentUser.email,
      fullName: currentUser.fullName,
      role: currentUser.role,
      createdAt: currentUser.createdAt,
      updatedAt: currentUser.updatedAt,
    };
  }

  /**
   * Helper: Set auth cookies cho web client
   */
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access token cookie (15 phút)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction, // HTTPS only trong production
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 phút
    });

    // Refresh token cookie (7 ngày)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });
  }

  /**
   * Helper: Clear auth cookies
   */
  private clearAuthCookies(res: Response): void {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }
}

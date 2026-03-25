import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private configService: ConfigService) {
    const options: StrategyOptionsWithRequest = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Hỗ trợ mobile: Bearer token trong header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Hỗ trợ web: Cookie
        (request) => {
          return request?.cookies?.refresh_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET') || 'refresh-secret',
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(req: Request, payload: JwtRefreshPayload) {
    // Lấy refresh token từ header hoặc cookie
    const refreshToken =
      req?.cookies?.refresh_token ||
      req?.get('authorization')?.replace('Bearer', '').trim();

    return {
      userId: payload.sub,
      email: payload.email,
      refreshToken,
    };
  }
}

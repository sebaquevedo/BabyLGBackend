import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService, type TokenContext } from './auth.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { LoginDto, RegisterDto } from './dto/auth.dto.js';

/**
 * The refresh token lives in an httpOnly cookie and never in a response body: an XSS in the
 * SPA must not be able to read it. The access token does travel in the body, because it is
 * meant to live in memory and be sent as `Authorization: Bearer`.
 */
const REFRESH_COOKIE = 'citera_rt';
/** Scoped to the auth routes: no other request carries the cookie at all. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Minimal cookie reader, so the app does not take a dependency for one header. */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create an account and its owner membership' })
  @ApiResponse({ status: 201, description: 'Returns the access token; refresh token is a cookie' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const context = this.tokenContext(request);
    const result = await this.auth.register(dto, context);
    this.setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
    return { accessToken: result.tokens.accessToken, user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in' })
  @ApiResponse({ status: 200, description: 'Returns the access token; refresh token is a cookie' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const context = this.tokenContext(request);
    const result = await this.auth.login(dto, context);
    this.setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
    return { accessToken: result.tokens.accessToken, user: result.user };
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh cookie and return a new access token' })
  @ApiResponse({ status: 401, description: 'refresh_reuse_detected revokes the whole family' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const presented = readCookie(request.headers.cookie, REFRESH_COOKIE);
    if (!presented) {
      throw new UnauthorizedException({
        code: 'missing_refresh_token',
        message: 'Sign in again.',
      });
    }

    const result = await this.auth.refresh(presented, this.tokenContext(request));
    this.setRefreshCookie(response, result.tokens.refreshToken, result.tokens.refreshExpiresAt);
    return { accessToken: result.tokens.accessToken, user: result.user };
  }

  /** Idempotent: logging out twice, or with a stale cookie, is still a successful logout. */
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the refresh family and clear the cookie' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(readCookie(request.headers.cookie, REFRESH_COOKIE));
    response.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current user with accounts and roles' })
  me(@CurrentUser('sub') userId: string) {
    return this.auth.me(userId);
  }

  private tokenContext(request: Request): TokenContext {
    return {
      userAgent: request.headers['user-agent'],
      ip: request.ip,
    };
  }

  private setRefreshCookie(response: Response, token: string, expiresAt: Date): void {
    response.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
    });
  }
}

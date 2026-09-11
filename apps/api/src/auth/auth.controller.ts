import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto.js';
import type { AuthUser } from './types/auth-user.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, request.ip);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.userId);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Post('logout')
  logout(@CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.authService.logout(user.userId, request.ip);
  }

  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthUser) {
    return this.authService.setupTwoFactor(user.userId);
  }

  @Post('2fa/enable')
  enableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.authService.enableTwoFactor(user.userId, dto.code);
  }

  @Post('2fa/disable')
  disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.authService.disableTwoFactor(user.userId, dto.code);
  }
}

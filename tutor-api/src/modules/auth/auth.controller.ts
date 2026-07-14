import { Body, Controller, Get, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  FacebookOAuthDto,
  GoogleOAuthDto,
  RefreshDto,
  RequestOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { AllowStatus, Public } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  // Chống SMS-pumping/spam OTP: siết theo IP (13-security). 5 lần / 5 phút.
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto.channel, dto.destination, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto, @Ip() ip: string) {
    return this.auth.verifyOtp(dto.request_id, dto.code, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('oauth/google')
  googleOAuth(@Body() dto: GoogleOAuthDto, @Ip() ip: string) {
    return this.auth.oauthLogin('google', dto.id_token, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('oauth/facebook')
  facebookOAuth(@Body() dto: FacebookOAuthDto, @Ip() ip: string) {
    return this.auth.oauthLogin('facebook', dto.access_token, ip);
  }

  @Public()
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Ip() ip: string) {
    return this.auth.refresh(dto.refresh_token, ip);
  }

  // Cho phép cả user chưa consent để client biết trạng thái sau verify.
  @AllowStatus('pending_consent', 'active')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.userId);
  }
}

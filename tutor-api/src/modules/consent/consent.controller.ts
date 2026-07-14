import { Body, Controller, Get, Headers, Ip, Post } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { RecordConsentDto } from './dto/consent.dto';
import { AllowStatus, Public } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller()
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @Public()
  @Get('legal/documents/active')
  active() {
    return this.consent.activeDocuments();
  }

  // Cần JWT, và endpoint này chính là để user pending_consent hoàn tất consent.
  @AllowStatus('pending_consent', 'active')
  @Post('legal/consents')
  record(
    @CurrentUser() user: AuthUser,
    @Body() dto: RecordConsentDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.consent.recordConsent(user.userId, dto, { ip, userAgent });
  }
}

import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { CheckoutDto, SepayWebhookDto } from './dto/billing.dto';
import { Public, Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Roles('parent', 'tutor')
  @Post('checkout')
  checkout(
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.billing.checkout(user, dto, idempotencyKey);
  }

  @Roles('parent', 'tutor')
  @Get('payments/:id')
  getPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.getPayment(user.userId, id);
  }

  @Public()
  @Post('webhook/sepay')
  handleSepayWebhook(
    @Body() payload: SepayWebhookDto,
    @Headers() headers: Record<string, string>,
    @Ip() ip: string,
  ) {
    return this.billing.handleSepayWebhook(payload, headers, ip);
  }

  @Roles('parent', 'tutor')
  @Get('subscriptions')
  listSubscriptions(@CurrentUser() user: AuthUser) {
    return this.billing.listSubscriptions(user.userId);
  }

  @Roles('parent', 'tutor')
  @Post('subscriptions/:id/cancel')
  cancelSubscription(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.cancelSubscription(user.userId, id);
  }
}

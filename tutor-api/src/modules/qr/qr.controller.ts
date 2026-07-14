import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { QrService } from './qr.service';
import { QrListQueryDto, QrRecordDto } from './dto/qr.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('qr')
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Roles('tutor')
  @Post('records')
  create(@CurrentUser() user: AuthUser, @Body() dto: QrRecordDto) {
    return this.qr.create(user.userId, dto);
  }

  @Roles('tutor')
  @Get('records')
  list(@CurrentUser() user: AuthUser, @Query() query: QrListQueryDto) {
    return this.qr.list(user.userId, query);
  }

  @Roles('tutor')
  @Post('records/:id/mark-collected')
  markCollected(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.qr.markCollected(user.userId, id);
  }
}

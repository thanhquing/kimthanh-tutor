import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { TutorsService } from './tutors.service';
import {
  AvailabilityDto,
  PayoutAccountDto,
  TutorProfileDto,
  UpdateTutorProfileDto,
} from './dto/tutor.dto';
import { OptionalAuth, Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutors: TutorsService) {}

  // Bootstrap vai trò gia sư: chỉ cần user active, chưa cần role 'tutor'.
  @Post('me/profile')
  upsertProfile(@CurrentUser() user: AuthUser, @Body() dto: TutorProfileDto) {
    return this.tutors.upsertProfile(user, dto);
  }

  @Roles('tutor')
  @Get('me/profile')
  getMyProfile(@CurrentUser() user: AuthUser) {
    return this.tutors.getMyProfile(user.userId);
  }

  @Roles('tutor')
  @Patch('me/profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateTutorProfileDto,
  ) {
    return this.tutors.updateProfile(user, dto);
  }

  @Roles('tutor')
  @Post('me/profile/publish')
  publish(@CurrentUser() user: AuthUser) {
    return this.tutors.publish(user.userId);
  }

  @Roles('tutor')
  @Get('me/availabilities')
  listAvailabilities(@CurrentUser() user: AuthUser) {
    return this.tutors.listAvailabilities(user.userId);
  }

  @Roles('tutor')
  @Post('me/availabilities')
  addAvailability(@CurrentUser() user: AuthUser, @Body() dto: AvailabilityDto) {
    return this.tutors.addAvailability(user.userId, dto);
  }

  @Roles('tutor')
  @Delete('me/availabilities/:id')
  removeAvailability(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutors.removeAvailability(user.userId, id);
  }

  @Roles('tutor')
  @Get('me/payout-accounts')
  listPayoutAccounts(@CurrentUser() user: AuthUser) {
    return this.tutors.listPayoutAccounts(user.userId);
  }

  @Roles('tutor')
  @Post('me/payout-accounts')
  addPayoutAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: PayoutAccountDto,
  ) {
    return this.tutors.addPayoutAccount(user.userId, dto);
  }

  // Chi tiết công khai: khách xem preview; phụ huynh đã đăng nhập thấy unlock_state.
  @OptionalAuth()
  @Get(':id/public')
  publicDetail(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.tutors.publicDetail(id, user);
  }
}

import { Controller, Get, Param, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';
import { PaginationQueryDto } from '../../common/pagination/pagination.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles('tutor')
  @Get('tutor/overview')
  tutorOverview(@CurrentUser() user: AuthUser) {
    return this.dashboard.tutorOverview(user.userId);
  }

  @Roles('parent')
  @Get('students/:id/overview')
  studentOverview(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dashboard.studentOverview(user.userId, id);
  }

  @Roles('parent')
  @Get('students/:id/detail')
  studentDetail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.dashboard.studentDetail(user.userId, id, query);
  }
}

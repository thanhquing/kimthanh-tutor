import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReportReviewDto, ReviewDto } from './dto/review.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Roles('parent')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.reviews.update(user.userId, id, dto);
  }

  @Roles('tutor')
  @Post(':id/report')
  report(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReportReviewDto,
  ) {
    return this.reviews.report(user.userId, id, dto);
  }
}

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { ReviewDto } from "./dto/review.dto";
import { Roles } from "../../common/auth/roles.decorator";
import { CurrentUser, AuthUser } from "../../common/auth/auth-user";

@Controller("classes")
export class ClassReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Roles("parent", "tutor")
  @Get(":id/review")
  getForClass(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.reviews.getForClass(user, id);
  }

  @Roles("parent")
  @Post(":id/review")
  create(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ReviewDto,
  ) {
    return this.reviews.create(user.userId, id, dto);
  }
}

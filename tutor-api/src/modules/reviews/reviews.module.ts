import { Module } from '@nestjs/common';
import { ClassReviewsController } from './class-reviews.controller';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ClassReviewsController, ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}

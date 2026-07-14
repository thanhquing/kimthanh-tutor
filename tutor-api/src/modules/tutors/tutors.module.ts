import { Module } from '@nestjs/common';
import { TutorsController } from './tutors.controller';
import { MediaController } from './media.controller';
import { TutorsService } from './tutors.service';

@Module({
  controllers: [TutorsController, MediaController],
  providers: [TutorsService],
})
export class TutorsModule {}

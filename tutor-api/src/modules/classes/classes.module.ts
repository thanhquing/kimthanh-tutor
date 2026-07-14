import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { LessonLogsController } from './lesson-logs.controller';
import { ClassesService } from './classes.service';

@Module({
  controllers: [ClassesController, LessonLogsController],
  providers: [ClassesService],
})
export class ClassesModule {}

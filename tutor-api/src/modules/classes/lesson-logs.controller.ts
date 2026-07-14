import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { UpdateLessonLogDto } from './dto/class.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('lesson-logs')
export class LessonLogsController {
  constructor(private readonly classes: ClassesService) {}

  @Roles('tutor')
  @Patch(':id')
  updateLessonLog(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLessonLogDto,
  ) {
    return this.classes.updateLessonLog(user.userId, id, dto);
  }
}

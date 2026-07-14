import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ClassesService } from "./classes.service";
import {
  LessonLogDto,
  LessonLogsQueryDto,
  TransitionDto,
} from "./dto/class.dto";
import { Roles } from "../../common/auth/roles.decorator";
import { CurrentUser, AuthUser } from "../../common/auth/auth-user";

@Controller("classes")
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Roles("parent", "tutor")
  @Get("mine")
  mine(@CurrentUser() user: AuthUser) {
    return this.classes.mine(user.userId);
  }

  @Roles("tutor", "parent")
  @Post(":id/transition")
  transition(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: TransitionDto,
  ) {
    return this.classes.transition(user.userId, id, dto);
  }

  @Roles("tutor")
  @Get(":id/lesson-logs")
  listLessonLogs(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query() query: LessonLogsQueryDto,
  ) {
    return this.classes.listLessonLogs(user.userId, id, query);
  }

  @Roles("tutor")
  @Post(":id/lesson-logs")
  createLessonLog(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: LessonLogDto,
  ) {
    return this.classes.createLessonLog(user.userId, id, dto);
  }
}

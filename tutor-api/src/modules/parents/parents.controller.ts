import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ParentsService } from './parents.service';
import { StudentDto, UpdateStudentDto, UpsertParentDto } from './dto/parent.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  // Bootstrap vai trò phụ huynh: chỉ cần user active, chưa cần role 'parent'.
  @Post('me')
  bootstrap(@CurrentUser() user: AuthUser, @Body() dto: UpsertParentDto) {
    return this.parents.bootstrap(user.userId, dto);
  }

  @Roles('parent')
  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.parents.getMe(user.userId);
  }

  @Roles('parent')
  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpsertParentDto) {
    return this.parents.updateMe(user.userId, dto);
  }

  @Roles('parent')
  @Get('me/students')
  listStudents(@CurrentUser() user: AuthUser) {
    return this.parents.listStudents(user.userId);
  }

  @Roles('parent')
  @Post('me/students')
  addStudent(@CurrentUser() user: AuthUser, @Body() dto: StudentDto) {
    return this.parents.addStudent(user.userId, dto);
  }

  @Roles('parent')
  @Patch('me/students/:id')
  updateStudent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.parents.updateStudent(user.userId, id, dto);
  }

  @Roles('parent')
  @Delete('me/students/:id')
  removeStudent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.parents.removeStudent(user.userId, id);
  }
}

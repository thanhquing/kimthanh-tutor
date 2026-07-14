import { Body, Controller, Post } from '@nestjs/common';
import { TutorsService } from './tutors.service';
import { MediaUploadDto } from './dto/tutor.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

@Controller('media')
export class MediaController {
  constructor(private readonly tutors: TutorsService) {}

  @Roles('tutor', 'parent')
  @Post('upload-url')
  createUploadUrl(@CurrentUser() user: AuthUser, @Body() dto: MediaUploadDto) {
    return this.tutors.createUploadUrl(user.userId, dto);
  }
}

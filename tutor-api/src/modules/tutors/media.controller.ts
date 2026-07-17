import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  // Trạng thái + URL đọc media của chính chủ sở hữu (fail closed theo owner).
  @Roles('tutor', 'parent')
  @Get(':id')
  getStatus(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutors.getMediaStatus(user.userId, id);
  }
}

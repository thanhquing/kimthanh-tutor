import { Controller, Get, Query } from '@nestjs/common';
import { SearchPort } from './search.port';
import { SearchQueryDto } from './dto/search-query.dto';
import { Public } from '../../common/auth/roles.decorator';

@Controller('tutors')
export class SearchController {
  constructor(private readonly search: SearchPort) {}

  @Public()
  @Get('search')
  find(@Query() q: SearchQueryDto) {
    return this.search.search(q);
  }
}

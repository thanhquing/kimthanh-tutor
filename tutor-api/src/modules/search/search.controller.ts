import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { Public } from '../../common/auth/roles.decorator';

@Controller('tutors')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @Get('search')
  find(@Query() q: SearchQueryDto) {
    return this.search.search(q);
  }
}

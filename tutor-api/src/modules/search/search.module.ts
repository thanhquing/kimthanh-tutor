import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchPort } from './search.port';
import { PgSearchAdapter } from './pg-search.adapter';

@Module({
  controllers: [SearchController],
  // Bind SearchPort -> adapter Postgres. Đổi engine = đổi useClass tại đây.
  providers: [{ provide: SearchPort, useClass: PgSearchAdapter }],
})
export class SearchModule {}

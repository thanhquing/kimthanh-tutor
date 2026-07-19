import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TrialsService } from './trials.service';
import {
  ActivationDto,
  CreateTrialDto,
  DeclineTrialDto,
  TrialActionDto,
  TrialMineQueryDto,
} from './dto/trial.dto';
import { OptionalAuth, Public, Roles } from '../../common/auth/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/auth/auth-user';

const TRIAL_THROTTLE_WINDOW_MS =
  Number(process.env.TRIAL_THROTTLE_WINDOW_SECONDS ?? 3600) * 1000;
const TRIAL_THROTTLE_LIMIT = Number(process.env.TRIAL_THROTTLE_LIMIT ?? 10);

@Controller()
export class TrialsController {
  constructor(private readonly trials: TrialsService) {}

  @OptionalAuth()
  @Throttle({
    default: {
      ttl: TRIAL_THROTTLE_WINDOW_MS,
      limit: TRIAL_THROTTLE_LIMIT,
    },
  })
  @Post('trials')
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateTrialDto) {
    return this.trials.create(user, dto);
  }

  @Roles('parent', 'tutor')
  @Get('trials/mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: TrialMineQueryDto) {
    return this.trials.mine(user, query);
  }

  @Roles('tutor')
  @Post('trials/:id/accept')
  accept(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TrialActionDto,
  ) {
    return this.trials.accept(user, id, dto);
  }

  @Roles('tutor')
  @Post('trials/:id/decline')
  decline(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DeclineTrialDto,
  ) {
    return this.trials.decline(user, id, dto);
  }

  @Roles('parent')
  @Post('trials/:id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TrialActionDto,
  ) {
    return this.trials.cancel(user, id, dto);
  }

  @Public()
  @Post('activation/complete')
  completeActivation(@Body() dto: ActivationDto) {
    return this.trials.completeActivation(dto);
  }
}

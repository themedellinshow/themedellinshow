import { Controller, Post, Body } from '@nestjs/common';
import { ModerationService, ModerationRequest } from './moderation.service';

@Controller({ path: 'moderation', version: '1' })
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @Post('check')
  async moderateContent(@Body() request: ModerationRequest) {
    return this.moderationService.moderateContent(request);
  }
}

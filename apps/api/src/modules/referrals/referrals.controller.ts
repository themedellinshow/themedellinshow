import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReferralsService } from './referrals.service';
import { RedeemReferralDto, ReferralAddressDto } from './dto/referral.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller({ path: 'referrals', version: '1' })
export class ReferralsController {
  constructor(private referralsService: ReferralsService) {}

  /** GET /api/v1/referrals/me — my code + lifetime stats */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@CurrentUser() user: User) {
    return this.referralsService.getStats(user.id);
  }

  @Post('me')
  @UseGuards(AuthGuard('jwt'))
  async ensureProgram(@CurrentUser() user: User) {
    return this.referralsService.getOrCreateForUser(user.id);
  }

  /** POST /api/v1/referrals/redeem — apply a code for my account */
  @Post('redeem')
  @UseGuards(AuthGuard('jwt'))
  async redeem(@CurrentUser() user: User, @Body() dto: RedeemReferralDto) {
    const redemption = await this.referralsService.redeem(user.id, {
      code: dto.code,
      sourceContext: dto.sourceContext,
    });
    return {
      id: redemption.id,
      status: redemption.status,
      message: 'Referral code applied. Rewards unlock after your first paid booking.',
    };
  }

  /** GET /api/v1/referrals/share?name=&language= — shareable text for WhatsApp/IG */
  @Get('share')
  @UseGuards(AuthGuard('jwt'))
  async share(@CurrentUser() user: User, @Query() dto: ReferralAddressDto) {
    const referral = await this.referralsService.getOrCreateForUser(user.id);
    const name = dto.name || 'Héctor';
    const lang = dto.language || 'es';
    const texts: Record<string, string> = {
      es: `¡Ven a Medellín con ${name}! Lee tu código ${referral.code} de Héctor al registrarte para ganar crédito en tu primera experiencia.`,
      en: `Come to Medellín with ${name}! Use code ${referral.code} from Héctor at signup to earn credit on your first experience.`,
      pt: `Venha para Medellín com ${name}! Use o código ${referral.code} do Héctor ao se cadastrar e ganhe crédito na sua primeira experiência.`,
    };
    return { code: referral.code, message: texts[lang] };
  }
}
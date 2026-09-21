import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { WalletService } from './wallet.service';

/**
 * Periodic wallet sweep: confirms eligible referral credits (completed purchase
 * + 72h window) and expires credits past their 12-month validity.
 */
@Injectable()
export class WalletScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WalletScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly walletService: WalletService) {}

  onApplicationBootstrap() {
    const minutes = Number(process.env.WALLET_SWEEP_INTERVAL_MINUTES ?? 30);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    const run = () => {
      Promise.all([
        this.walletService.confirmEligible(),
        this.walletService.expireCredits(),
      ]).catch((error) => this.logger.error(`Wallet sweep failed: ${error}`));
    };

    this.timer = setInterval(run, minutes * 60 * 1000);
    run();
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
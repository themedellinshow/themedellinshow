import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PayoutsService } from './payouts.service';

/**
 * Periodic sweep:
 * - releases pending payouts whose 72h dispute window has elapsed, and
 * - runs the weekly payout batch when due (PAYOUT_BATCH_PERIOD_MINUTES, default 7d).
 */
@Injectable()
export class PayoutBatchScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PayoutBatchScheduler.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly payoutsService: PayoutsService) {}

  onApplicationBootstrap() {
    const minutes = Number(process.env.PAYOUT_SWEEP_INTERVAL_MINUTES ?? 30);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    const run = () => {
      this.payoutsService.sweep().catch((error) =>
        this.logger.error(`Payout sweep failed: ${error}`),
      );
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
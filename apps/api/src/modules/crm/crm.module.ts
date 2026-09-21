import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CrmContact } from './entities/crm-contact.entity';
import { CrmInteraction } from './entities/crm-interaction.entity';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { CrmQueueService } from './crm.queue.service';
import { CrmProcessor } from './crm.processor';
import { CrmAuditService } from './crm-audit.service';
import { CrmSegment } from './entities/crm-segment.entity';
import { CrmSegmentMember } from './entities/crm-segment-member.entity';
import { CrmTask } from './entities/crm-task.entity';
import { CrmAuditLog } from './entities/crm-audit-log.entity';
import { CrmMarketingService } from './crm-marketing.service';
import { CrmCampaign } from './entities/crm-campaign.entity';
import { CrmCampaignRecipient } from './entities/crm-campaign-recipient.entity';
import { CrmAutomation } from './entities/crm-automation.entity';
import { CrmAutomationRun } from './entities/crm-automation-run.entity';
import { CrmContactNote } from './entities/crm-contact-note.entity';
import { CrmPipeline, CrmStage } from './entities/crm-pipeline.entity';
import { CrmPipelineService } from './crm-pipeline.service';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CrmContact,
      CrmInteraction,
      User,
      Booking,
      CrmSegment,
      CrmSegmentMember,
      CrmTask,
      CrmAuditLog,
      CrmCampaign,
      CrmCampaignRecipient,
      CrmAutomation,
      CrmAutomationRun,
      CrmContactNote,
      CrmPipeline,
      CrmStage,
    ]),
    BullModule.registerQueue({ name: 'crm' }),
  ],
  controllers: [CrmController],
  providers: [
    CrmService,
    CrmQueueService,
    CrmProcessor,
    CrmAuditService,
    CrmMarketingService,
    CrmPipelineService,
  ],
  exports: [CrmService, CrmQueueService],
})
export class CrmModule {}
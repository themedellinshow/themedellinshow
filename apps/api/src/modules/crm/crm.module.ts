import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmContact } from './entities/crm-contact.entity';
import { CrmInteraction } from './entities/crm-interaction.entity';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CrmContact, CrmInteraction])],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}

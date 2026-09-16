import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Experience } from './entities/experience.entity';
import { ExperiencesService } from './experiences.service';
import { ExperiencesController } from './experiences.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Experience])],
  controllers: [ExperiencesController],
  providers: [ExperiencesService],
  exports: [ExperiencesService],
})
export class ExperiencesModule {}

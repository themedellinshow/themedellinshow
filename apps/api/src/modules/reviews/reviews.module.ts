import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { ExperiencesModule } from '../experiences/experiences.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    HttpModule,
    BookingsModule,
    ExperiencesModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}

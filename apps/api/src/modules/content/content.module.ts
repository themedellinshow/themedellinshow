import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Place } from './entities/place.entity';
import { Event } from './entities/event.entity';
import { Guide } from './entities/guide.entity';
import { Experience } from '../experiences/entities/experience.entity';
import { PlacesService } from './places.service';
import { EventsService } from './events.service';
import { GuidesService } from './guides.service';
import { MapService } from './map.service';
import { PlacesController } from './places.controller';
import { EventsController } from './events.controller';
import { GuidesController } from './guides.controller';
import { MapController } from './map.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Place, Event, Guide, Experience])],
  controllers: [PlacesController, EventsController, GuidesController, MapController],
  providers: [PlacesService, EventsService, GuidesService, MapService],
  exports: [PlacesService, EventsService, GuidesService, MapService],
})
export class ContentModule {}

import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { MapService } from './map.service';

@Controller({ path: 'map', version: '1' })
export class MapController {
  constructor(private mapService: MapService) {}

  /**
   * Returns geo pins inside the given bounding box, aggregated across
   * places, events and experiences. Mobile-first: intended for map view.
   */
  @Get('pins')
  async pins(
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLng') minLng: string,
    @Query('maxLng') maxLng: string,
    @Query('includePlaces') includePlaces?: string,
    @Query('includeEvents') includeEvents?: string,
    @Query('includeExperiences') includeExperiences?: string,
    @Query('category') category?: string,
    @Query('lgbtqFriendly') lgbtqFriendly?: string,
    @Query('lang') lang?: 'es' | 'en',
  ) {
    if (!minLat || !maxLat || !minLng || !maxLng) {
      throw new BadRequestException('minLat, maxLat, minLng, maxLng are required');
    }

    return this.mapService.pinsInBounds(
      {
        minLat: parseFloat(minLat),
        maxLat: parseFloat(maxLat),
        minLng: parseFloat(minLng),
        maxLng: parseFloat(maxLng),
        includePlaces: includePlaces !== 'false',
        includeEvents: includeEvents !== 'false',
        includeExperiences: includeExperiences !== 'false',
        category,
        lgbtqFriendly: lgbtqFriendly === 'true',
      },
      lang || 'es',
    );
  }
}

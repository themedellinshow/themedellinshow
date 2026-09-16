import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PlacesService, QueryPlacesDto } from './places.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Place } from './entities/place.entity';

@Controller({ path: 'places', version: '1' })
export class PlacesController {
  constructor(private placesService: PlacesService) {}

  @Get()
  async findAll(@Query() query: QueryPlacesDto) {
    return this.placesService.findAll(query);
  }

  @Get('nearby')
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.placesService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseFloat(radius) : undefined,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.placesService.findById(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async create(@Body() data: Partial<Place>) {
    return this.placesService.create(data);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: Partial<Place>) {
    return this.placesService.update(id, data);
  }
}

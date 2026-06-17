import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ForwardGeocodeDto, ReverseGeocodeQueryDto } from './dto/geocode.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocode')
@UseGuards(JwtAuthGuard)
export class GeocodingController {
  constructor(private readonly geocoding: GeocodingService) {}

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('forward')
  forward(@Body() dto: ForwardGeocodeDto) {
    return this.geocoding.forward(dto.address);
  }

  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('reverse')
  reverse(@Query() query: ReverseGeocodeQueryDto) {
    return this.geocoding.reverse(query.lat, query.lng);
  }
}

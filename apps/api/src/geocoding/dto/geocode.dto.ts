import { IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class ForwardGeocodeDto {
  @IsString()
  @MinLength(3)
  address!: string;
}

export class ReverseGeocodeQueryDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

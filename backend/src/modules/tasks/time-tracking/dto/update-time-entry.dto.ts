import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export class UpdateTimeEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  started_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ended_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_billable?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID, IsDateString, IsOptional, IsString, IsObject,
} from 'class-validator';

export class MarkAttendanceDto {
  @ApiProperty()
  @IsUUID()
  employee_id!: string;

  @ApiProperty({ example: '2026-06-02' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '2026-06-02T09:00:00Z' })
  @IsOptional()
  @IsDateString()
  check_in?: string;

  @ApiPropertyOptional({ example: '2026-06-02T18:00:00Z' })
  @IsOptional()
  @IsDateString()
  check_out?: string;

  @ApiPropertyOptional({ example: { lat: 12.9716, lng: 77.5946 } })
  @IsOptional()
  @IsObject()
  check_in_location?: { lat: number; lng: number; address?: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RegularizeAttendanceDto {
  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  check_in?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  check_out?: string;
}

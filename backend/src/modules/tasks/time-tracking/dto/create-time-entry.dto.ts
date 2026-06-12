import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateTimeEntryDto {
  @ApiProperty({ example: '2026-06-02T08:00:00Z' })
  @IsDateString()
  started_at!: string;

  @ApiProperty({ example: '2026-06-02T10:30:00Z' })
  @IsDateString()
  ended_at!: string;

  @ApiPropertyOptional({ example: 'Worked on login UI' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_billable?: boolean;
}

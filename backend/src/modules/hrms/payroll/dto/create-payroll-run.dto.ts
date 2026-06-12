import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class CreatePayrollRunDto {
  @ApiProperty({ example: 6, description: '1-12' })
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  year!: number;
}

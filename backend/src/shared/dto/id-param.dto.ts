import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class IdParamDto {
  @ApiProperty({ description: 'Record ID (cuid)', example: 'clx1a2b3c4d5e6f7g8h9i0j' })
  @IsString()
  @IsNotEmpty()
  id!: string;
}

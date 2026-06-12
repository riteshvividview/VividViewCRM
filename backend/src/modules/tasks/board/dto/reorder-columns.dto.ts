import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderColumnsDto {
  @ApiProperty({ type: [String], description: 'Column IDs in desired order' })
  @IsArray()
  @IsUUID('4', { each: true })
  order!: string[];
}

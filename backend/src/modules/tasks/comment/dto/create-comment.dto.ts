import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Looks good! @john can you review the auth flow?' })
  @IsString()
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ description: 'UUID of parent comment for threaded replies' })
  @IsOptional()
  @IsUUID()
  parent_comment_id?: string;
}

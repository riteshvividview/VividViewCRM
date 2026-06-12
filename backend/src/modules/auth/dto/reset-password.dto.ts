import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, Length } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@vividview.in' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '482910' })
  @IsString()
  @Length(6, 6)
  otp!: string;

  @ApiProperty({ example: 'NewPassword123!' })
  @IsString()
  @MinLength(8)
  new_password!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCompanyInfoDto {
  @ApiProperty({ example: 'Ish vaqti' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Dushanbadan shanbagacha 09:00 dan 19:00 gacha ishlaymiz.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

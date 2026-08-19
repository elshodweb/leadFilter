import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAdditionalInfoDto {
  @ApiProperty({ example: 'Pasport muddati' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example:
      "Sayohat qilish uchun pasportning amal qilish muddati kamida 6 oy bo'lishi kerak.",
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

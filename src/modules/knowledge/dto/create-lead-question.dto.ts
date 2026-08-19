import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLeadQuestionDto {
  @ApiProperty({ example: 'Telefon raqami' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: "Mijozdan bog'lanish uchun telefon raqamini so'rang.",
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateLeadQuestionDto {
  @ApiPropertyOptional({ example: 'Telefon raqami' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: "Mijozdan bog'lanish uchun telefon raqamini so'rang.",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Target 1-based order position to swipe/reorder',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}

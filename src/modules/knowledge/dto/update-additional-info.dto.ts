import { PartialType } from '@nestjs/mapped-types';
import { CreateAdditionalInfoDto } from './create-additional-info.dto';
export class UpdateAdditionalInfoDto extends PartialType(
  CreateAdditionalInfoDto,
) {}

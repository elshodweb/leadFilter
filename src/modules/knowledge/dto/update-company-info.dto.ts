import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyInfoDto } from './create-company-info.dto';
export class UpdateCompanyInfoDto extends PartialType(CreateCompanyInfoDto) {}

import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PERMISSIONS, type Permission } from '../../common/permissions.js';
import { UserRole } from '../../generated/prisma/enums.js';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsArray()
  @IsIn(PERMISSIONS, { each: true })
  permissions?: Permission[];
}

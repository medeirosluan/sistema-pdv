import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  tenantSlug: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  @IsOptional()
  @IsString()
  totp?: string;
}

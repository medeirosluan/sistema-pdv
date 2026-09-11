import { IsEmail, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @MinLength(1)
  tenantSlug: string;

  @IsEmail()
  email: string;
}

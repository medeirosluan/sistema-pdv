import { IsString, Length } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

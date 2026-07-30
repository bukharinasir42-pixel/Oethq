import { IsEmail, Length, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @Length(6, 6)
  code!: string;

  @MinLength(8)
  newPassword!: string;
}

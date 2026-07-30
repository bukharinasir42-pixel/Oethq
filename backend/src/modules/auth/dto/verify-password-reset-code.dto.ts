import { IsEmail, Length } from "class-validator";

export class VerifyPasswordResetCodeDto {
  @IsEmail()
  email!: string;

  @Length(6, 6)
  code!: string;
}

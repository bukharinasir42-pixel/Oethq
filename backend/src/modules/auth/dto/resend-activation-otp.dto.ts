import { IsNotEmpty, IsString } from "class-validator";

export class ResendActivationOtpDto {
  @IsString()
  @IsNotEmpty()
  activationToken!: string;
}

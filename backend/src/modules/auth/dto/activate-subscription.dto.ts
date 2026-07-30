import { IsNotEmpty, IsString, Length } from "class-validator";

export class ActivateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  activationToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

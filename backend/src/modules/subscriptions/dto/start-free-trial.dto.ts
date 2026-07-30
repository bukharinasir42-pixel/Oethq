import { IsNotEmpty } from "class-validator";

export class StartFreeTrialDto {
  @IsNotEmpty()
  userId!: string;
}

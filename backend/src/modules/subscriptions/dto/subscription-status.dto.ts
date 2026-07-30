import { IsNotEmpty } from "class-validator";

export class SubscriptionStatusDto {
  @IsNotEmpty()
  userId!: string;
}

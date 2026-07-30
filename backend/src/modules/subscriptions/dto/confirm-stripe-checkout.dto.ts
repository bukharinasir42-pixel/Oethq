import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class ConfirmStripeCheckoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  sessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  purchaseId?: string;
}

import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class CreatePurchaseIntentDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;
}

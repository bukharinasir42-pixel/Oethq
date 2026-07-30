import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class ResolvePurchaseDto {
  @IsIn(["COMPLETED", "FAILED"])
  status!: "COMPLETED" | "FAILED";

  @IsOptional()
  @IsString()
  @MaxLength(64)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  eventId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;

  @IsOptional()
  @IsObject()
  receiptData?: Record<string, unknown>;
}

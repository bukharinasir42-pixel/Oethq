import { IsOptional, IsString } from "class-validator";

export class SendPurchaseEmailDto {
  @IsString()
  userId!: string;

  @IsString()
  planId!: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

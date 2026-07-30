import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min } from "class-validator";
import { PlanTier } from "@prisma/client";

export class CreatePlanDto {
  @IsNotEmpty()
  name!: string;

  @IsEnum(PlanTier)
  tier!: PlanTier;

  @IsOptional()
  description?: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsOptional()
  @IsNotEmpty()
  currency?: string;

  @IsNumber()
  @Min(0)
  readingLimit!: number;

  @IsNumber()
  @Min(0)
  listeningLimit!: number;

  @IsNumber()
  @Min(0)
  pastPaperLimit!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  writingLimit?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  durationDays?: number;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

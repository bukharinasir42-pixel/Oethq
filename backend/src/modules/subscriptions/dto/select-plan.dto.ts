import { PlanTier } from "@prisma/client";
import { IsEnum, IsUUID, ValidateIf } from "class-validator";

export class SelectPlanDto {
  @ValidateIf((dto: SelectPlanDto) => !dto.tier)
  @IsUUID()
  planId?: string;

  @ValidateIf((dto: SelectPlanDto) => !dto.planId)
  @IsEnum(PlanTier)
  tier?: PlanTier;
}

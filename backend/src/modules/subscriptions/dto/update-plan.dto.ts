import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf
} from "class-validator";

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  readingLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  listeningLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pastPaperLimit?: number;

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
  isActive?: boolean;
}

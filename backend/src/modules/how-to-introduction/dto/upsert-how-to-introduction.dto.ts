import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";

export class UpsertHowToIntroductionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsUUID()
  videoAssetId?: string | null;

  @IsOptional()
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsUUID()
  thumbnailAssetId?: string | null;
}

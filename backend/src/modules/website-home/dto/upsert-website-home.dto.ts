import { IsOptional, IsUUID, ValidateIf } from "class-validator";

export class UpsertWebsiteHomeDto {
  @IsOptional()
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsUUID()
  heroVideoAssetId?: string | null;
}

import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from "class-validator";
import { BlogType } from "@prisma/client";

export class UpdateBlogDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsOptional()
  @IsEnum(BlogType)
  blogType?: BlogType;

  @IsOptional()
  @ValidateIf((_, v: unknown) => v !== null && v !== undefined)
  @IsUUID()
  imageAssetId?: string | null;
}

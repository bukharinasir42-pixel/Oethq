import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { BlogType } from "@prisma/client";

export class CreateBlogDto {
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsEnum(BlogType)
  blogType!: BlogType;

  @IsOptional()
  @IsUUID()
  imageAssetId?: string;
}

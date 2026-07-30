import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class PresignUploadDto {
  @IsString()
  title!: string;

  @IsString()
  filename!: string;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dayNumber?: number;

  @IsOptional()
  @IsString()
  slot?: string;
}

export class CompleteUploadDto {
  @IsString()
  objectKey!: string;

  @IsString()
  title!: string;

  @IsString()
  contentType!: string;

  @IsNumber()
  @Min(1)
  sizeBytes!: number;
}

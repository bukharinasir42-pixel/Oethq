import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpsertDailyTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  lectureTitle!: string;

  @IsOptional()
  @IsString()
  lectureUrl?: string;

  @IsOptional()
  @IsString()
  lectureAssetId?: string;

  @IsOptional()
  @IsString()
  lectureThumbnailAssetId?: string;

  @IsString()
  articleTitle!: string;

  @IsOptional()
  @IsString()
  articleUrl?: string;

  @IsOptional()
  @IsString()
  articleAssetId?: string;

  @IsOptional()
  @IsString()
  articleThumbnailAssetId?: string;

  @IsOptional()
  @IsString()
  articleContent?: string;

  @IsOptional()
  @IsString()
  articlePdfAssetId?: string;

  @IsOptional()
  @IsString()
  assignedReadingTestId?: string;

  @IsOptional()
  @IsString()
  assignedListeningTestId?: string;

  @IsOptional()
  @IsString()
  assignedPastPaperId?: string;

  @IsOptional()
  @IsString()
  assignedPastPaperTestId?: string;

  @IsOptional()
  @IsString()
  pastPaperTitle?: string;

  @IsOptional()
  @IsString()
  pastPaperUrl?: string;

  @IsOptional()
  @IsString()
  pastPaperAssetId?: string;

  @IsOptional()
  @IsString()
  cheatSheetAssetId?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

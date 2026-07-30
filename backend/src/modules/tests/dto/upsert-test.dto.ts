import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { TestType } from "@prisma/client";
import { ListeningTrackDto } from "./listening-track.dto";
import { UpsertQuestionDto } from "./upsert-question.dto";

export class UpsertTestDto {
  @IsEnum(TestType)
  type!: TestType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  partASubInstructions?: string;

  @IsOptional()
  @IsString()
  partBSubInstructions?: string;

  @IsOptional()
  @IsString()
  partCSubInstructions?: string;

  @IsOptional()
  @IsString()
  partABookletHtml?: string;

  @IsOptional()
  @IsString()
  partBBookletHtml?: string;

  @IsOptional()
  @IsObject()
  partBExtractBooklets?: Record<string, string> | null;

  @IsOptional()
  @IsObject()
  partAExtractQuestionHeadings?: Record<string, string> | null;

  @IsOptional()
  @IsObject()
  partAQuestionHeadingGroups?: Record<
    string,
    Array<{ id: string; heading: string; questionSequences: number[] }>
  > | null;

  @IsOptional()
  @IsObject()
  partCExtractQuestionHeadings?: Record<string, string> | null;

  @IsOptional()
  @IsObject()
  partCExtractBooklets?: Record<string, string> | null;

  @IsOptional()
  @IsString()
  partCBookletHtml?: string;

  @IsInt()
  @Min(1)
  totalQuestions!: number;

  @IsInt()
  @Min(1)
  timerDuration!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  partATimer?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  partBCTimer?: number;

  @IsOptional()
  @IsString()
  audioAssetId?: string;

  @IsOptional()
  @IsString()
  bookletAssetId?: string;

  @IsOptional()
  @IsString()
  partBBookletAssetId?: string;

  @IsOptional()
  @IsString()
  partCBookletAssetId?: string;

  /** Legacy per-extract tracks. New listening tests should use `audioAssetId` for one session audio file. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListeningTrackDto)
  listeningTracks?: ListeningTrackDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertQuestionDto)
  questions!: UpsertQuestionDto[];
}

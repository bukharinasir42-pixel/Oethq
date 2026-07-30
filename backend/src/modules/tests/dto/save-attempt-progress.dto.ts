import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";
import { AttemptSection } from "@prisma/client";

class AttemptAnswerDto {
  @IsString()
  questionId!: string;

  @IsString()
  response!: string;
}

export class SaveAttemptProgressDto {
  @IsEnum(AttemptSection)
  section!: AttemptSection;

  @IsInt()
  @Min(0)
  currentQuestionIndex!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  timeRemainingSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  audioPositionSeconds?: number;

  @IsOptional()
  @IsBoolean()
  audioCompleted?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentListeningTrackIndex?: number;

  /** ISO-8601; when last listening extract ends, client sets now+10s for auto-submit. Null clears. */
  @IsOptional()
  @Allow()
  listeningFinalCountdownEndsAt?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(42)
  questionCountAnswered?: number;

  /** Candidate chose to leave Part A before the 15-minute timer ended. */
  @IsOptional()
  @IsBoolean()
  finishPartAEarly?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers!: AttemptAnswerDto[];
}

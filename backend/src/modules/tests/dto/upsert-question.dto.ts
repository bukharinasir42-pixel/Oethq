import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { QuestionPart, QuestionType } from "@prisma/client";

export class UpsertQuestionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsInt()
  @Min(1)
  sequence!: number;

  @IsEnum(QuestionPart)
  part!: QuestionPart;

  @IsOptional()
  @IsString()
  extractId?: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsString()
  content!: string;

  @IsOptional()
  @IsArray()
  options?: string[];

  @IsString()
  correctAnswer!: string;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  points?: number;
}

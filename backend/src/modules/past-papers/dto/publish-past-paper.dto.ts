import { IsBoolean } from "class-validator";

export class PublishPastPaperDto {
  @IsBoolean()
  isPublished!: boolean;
}

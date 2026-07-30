import { IsBoolean } from "class-validator";

export class PublishTestDto {
  @IsBoolean()
  isPublished!: boolean;
}

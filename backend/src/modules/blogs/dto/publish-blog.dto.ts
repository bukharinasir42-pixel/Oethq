import { IsBoolean } from "class-validator";

export class PublishBlogDto {
  @IsBoolean()
  publish!: boolean;
}

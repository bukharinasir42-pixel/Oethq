import { IsBoolean, IsOptional } from "class-validator";
import { SaveAttemptProgressDto } from "./save-attempt-progress.dto";

export class SubmitAttemptDto extends SaveAttemptProgressDto {
  @IsOptional()
  @IsBoolean()
  autoSubmit?: boolean;
}

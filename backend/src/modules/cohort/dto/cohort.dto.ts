import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class OnboardingTimezoneDto {
  @IsString()
  @MaxLength(64)
  country!: string;

  @IsString()
  @MaxLength(64)
  timezone!: string; // IANA — validated again in service via isValidTimeZone
}

export class OnboardingScheduleDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "class1Time must be HH:mm" })
  class1Time!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "class2Time must be HH:mm" })
  class2Time!: string;
}

export class SessionProgressDto {
  /** Player's current position in seconds. */
  @IsInt() @Min(0) @Max(60 * 60 * 6)
  positionSec!: number;

  /** Seconds of ACTIVE watching since the previous heartbeat (throttled, <= 120). */
  @IsInt() @Min(0) @Max(120)
  activeDeltaSec!: number;

  @IsOptional()
  @IsIn(["live", "recording"])
  mode?: "live" | "recording";
}

export class ChatMessageDto {
  @IsString()
  @MinLength(1, { message: "Message cannot be empty" })
  @MaxLength(2000, { message: "Message is too long (max 2000)" })
  text!: string;
}

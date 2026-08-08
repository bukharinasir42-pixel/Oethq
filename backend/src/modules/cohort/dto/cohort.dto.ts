import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString,
  Matches, Max, MaxLength, Min, MinLength, ValidateNested
} from "class-validator";

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

export class ClassDayDto {
  /** 0 = Sunday … 6 = Saturday. */
  @IsInt() @Min(0) @Max(6)
  weekday!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "class1Time must be HH:mm" })
  class1Time!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "class2Time must be HH:mm" })
  class2Time!: string;
}

/**
 * Exactly four class days. The count is pinned at both ends so a malformed
 * payload is refused here rather than producing a half-built calendar; the
 * service checks it again, along with duplicate weekdays and the class gap.
 */
export class ClassDaysDto {
  @IsArray()
  @ArrayMinSize(4, { message: "Choose exactly 4 class days" })
  @ArrayMaxSize(4, { message: "Choose exactly 4 class days" })
  @ValidateNested({ each: true })
  @Type(() => ClassDayDto)
  days!: ClassDayDto[];
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

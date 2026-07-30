import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class ListeningTrackDto {
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  assetId!: string;
}

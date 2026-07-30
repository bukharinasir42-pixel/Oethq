import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateCustomUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  planId!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;
}

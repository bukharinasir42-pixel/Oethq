import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDto {
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  profession!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  heardFrom!: string;
}

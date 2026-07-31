import { ArrayNotEmpty, IsArray, IsEmail, IsInt, IsOptional, IsPositive, IsString, MinLength } from "class-validator";

/**
 * Admin "create candidate" payload.
 *
 * A candidate may be given a Complete Course plan, one or more individual
 * (standalone) course packages, or both — so `planId` is optional and the
 * service rejects a request that carries neither.
 */
export class CreateCustomUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  /** Complete Course plan. Optional: a candidate may get only single-skill courses. */
  @IsOptional()
  @IsString()
  planId?: string;

  /** Standalone product slugs to grant, e.g. ["reading-precision", "writing-momentum"]. */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  productSlugs?: string[];

  /** Optional override for how long the granted packages last. Defaults to each product's own duration. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  productDays?: number;

  @IsOptional()
  @IsString()
  @MinLength(8)
  temporaryPassword?: string;
}

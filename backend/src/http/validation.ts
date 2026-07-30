import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";

export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.flatMap((e) => (e.constraints ? Object.values(e.constraints) : [])).join("; ") || "Validation failed";
}

export async function validateDto<T extends object>(Cls: new () => T, body: unknown): Promise<T> {
  const dto = plainToInstance(Cls, body ?? {});
  const errors = await validate(dto as object);
  if (errors.length) {
    throw Object.assign(new Error(formatValidationErrors(errors)), { statusCode: 400 });
  }
  return dto;
}

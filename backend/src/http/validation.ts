import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";

/**
 * Recurses into `children` so a nested DTO (an array of objects, say) reports
 * the real reason instead of the bare "Validation failed" fallback.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  const collect = (list: ValidationError[]): string[] =>
    list.flatMap((e) => [
      ...(e.constraints ? Object.values(e.constraints) : []),
      ...(e.children?.length ? collect(e.children) : [])
    ]);
  return collect(errors).join("; ") || "Validation failed";
}

export async function validateDto<T extends object>(Cls: new () => T, body: unknown): Promise<T> {
  const dto = plainToInstance(Cls, body ?? {});
  const errors = await validate(dto as object);
  if (errors.length) {
    throw Object.assign(new Error(formatValidationErrors(errors)), { statusCode: 400 });
  }
  return dto;
}

export interface ErrorResult {
  ok: false;
  error: string;
  details?: unknown;
}

export interface SuccessResult<T> {
  ok: true;
  data: T;
}

export type Result<T> = SuccessResult<T> | ErrorResult;

export function success<T>(data: T): SuccessResult<T> {
  return { ok: true, data };
}

export function failure(error: string, details?: unknown): ErrorResult {
  return { ok: false, error, details };
}

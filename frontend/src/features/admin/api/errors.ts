/**
 * Typed API error for the admin (UI-035): the contract's error envelope `{ error: { code, message, fields? } }`
 * parsed into `ApiError { status, code, message, fields? }`. Network failures become status 0 / `network_error`.
 */
import type { components } from "@/api/schema";

export type ApiErrorCode = components["schemas"]["Error"]["error"]["code"] | "network_error" | "unknown_error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields: Record<string, string> | undefined;

  constructor(status: number, code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function isEnvelope(value: unknown): value is components["schemas"]["Error"] {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const inner = (value as { error: unknown }).error;
  return typeof inner === "object" && inner !== null && "code" in inner && "message" in inner;
}

export function toApiError(status: number, body: unknown): ApiError {
  if (isEnvelope(body)) {
    return new ApiError(status, body.error.code, body.error.message, body.error.fields);
  }
  return new ApiError(status, "unknown_error", `Request failed with status ${status}`);
}

interface FetchResultLike<D> {
  data?: D;
  error?: unknown;
  response: Response;
}

/**
 * Awaits an openapi-fetch call and returns its data, or throws `ApiError`. 204 responses resolve to `undefined`
 * (typed as the operation's data type, which is `never`/`undefined` for 204-only operations).
 */
export async function call<D>(request: Promise<FetchResultLike<D>>): Promise<D> {
  let result: FetchResultLike<D>;
  try {
    result = await request;
  } catch {
    throw new ApiError(0, "network_error", "The server could not be reached.");
  }
  if (!result.response.ok) throw toApiError(result.response.status, result.error);
  return result.data as D;
}

/** True for errors worth retrying automatically (network and 5xx; never 4xx). */
export function isRetryable(error: unknown): boolean {
  return isApiError(error) && (error.isNetwork || error.status >= 500);
}

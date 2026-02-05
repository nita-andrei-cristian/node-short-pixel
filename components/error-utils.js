/**
 * Custom Error Classes
 */
export class ShortPixelError extends Error {
  constructor(
    message,
    { httpStatus = null, spCode = null, spMessage = null, payload = null, cause = null } = {}
  ) {
    super(message);
    this.name = "ShortPixelError";
    this.httpStatus = httpStatus;
    this.spCode = spCode;
    this.spMessage = spMessage;
    this.payload = payload;
    this.cause = cause;
  }
}
export class ShortPixelAuthError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelAuthError";
  }
}
export class ShortPixelQuotaError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelQuotaError";
  }
}
export class ShortPixelTemporaryError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelTemporaryError";
  }
}
export class ShortPixelInvalidRequestError extends ShortPixelError {
  constructor(message, meta = {}) {
    super(message, meta);
    this.name = "ShortPixelInvalidRequestError";
  }
}

export class ShortPixelBatchError extends ShortPixelError {
  constructor(message, { items = [], ...meta } = {}) {
    super(message, meta);
    this.name = "ShortPixelBatchError";
    this.items = items; // [{ index, input, meta?, error? }]
  }
}


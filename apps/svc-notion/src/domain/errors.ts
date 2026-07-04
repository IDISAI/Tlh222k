// Domain errors — interface layer maps these onto transport codes.

export class ForbiddenError extends Error {
  constructor(message = "Not a member of this workspace") {
    super(message)
    this.name = "ForbiddenError"
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Sign in required") {
    super(message)
    this.name = "UnauthenticatedError"
  }
}

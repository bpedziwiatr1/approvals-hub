import { DataError } from "../dataClient";
import type { XrmErrorLike } from "./xrmTypes";

/** Dataverse error codes meaning the user lacks a privilege. */
const PRIVILEGE_ERROR_CODES = new Set([
  -2147220960, // 0x80040220 SecLib::CheckPrivilege / AccessCheck failed
]);
const PRIVILEGE_MESSAGE = /missing\s+\S*\s*privilege|\bprv[A-Z]\w+/;

/** Maps whatever Xrm.WebApi rejected with to a typed DataError: forbidden for 403 / privilege errors, else server. */
export function toDataError(error: unknown): DataError {
  if (error instanceof DataError) return error;
  const e: XrmErrorLike = typeof error === "object" && error !== null ? (error as XrmErrorLike) : {};
  const message = (typeof e.message === "string" && e.message) || (typeof error === "string" && error) || "Dataverse request failed";
  const forbidden =
    e.status === 403 || (typeof e.errorCode === "number" && PRIVILEGE_ERROR_CODES.has(e.errorCode)) || PRIVILEGE_MESSAGE.test(message);
  return new DataError(forbidden ? "forbidden" : "server", message);
}

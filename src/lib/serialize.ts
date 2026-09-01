/**
 * Recursively convert Date values to ISO strings so DB rows can be
 * validated against the generated OpenAPI response schemas, which
 * type all timestamps as strings.
 */
export function serializeDates<T>(value: T): T {
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serializeDates(v)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        serializeDates(v),
      ]),
    ) as unknown as T;
  }
  return value;
}

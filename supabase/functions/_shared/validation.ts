export class RequestError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RequestError("INVALID_INPUT", 400);
  return value as Record<string, unknown>;
}
export function text(value: unknown, max: number, required = true) {
  if (typeof value !== "string") throw new RequestError("INVALID_INPUT", 400);
  const result = value.trim();
  if ((required && !result) || result.length > max)
    throw new RequestError("INVALID_INPUT", 400);
  return result;
}
export function uuid(value: unknown) {
  const result = text(value, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      result,
    )
  )
    throw new RequestError("INVALID_INPUT", 400);
  return result;
}
function oneOf(value: unknown, allowed: string[]) {
  if (typeof value !== "string" || !allowed.includes(value))
    throw new RequestError("INVALID_INPUT", 400);
  return value;
}
export function parseClaim(value: unknown) {
  const body = object(value);
  const slug = text(body.slug, 64);
  const token = text(body.token, 64);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || !/^[a-f0-9]{64}$/.test(token))
    throw new RequestError("INVALID_QR", 400);
  return { slug, token };
}
export function parseEvent(value: unknown) {
  const input = object(value);
  const slug = text(input.slug, 64);
  const starts_at = text(input.starts_at, 40);
  const ends_at = text(input.ends_at, 40);
  if (
    !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
    !Number.isFinite(Date.parse(starts_at)) ||
    !Number.isFinite(Date.parse(ends_at)) ||
    Date.parse(ends_at) <= Date.parse(starts_at)
  )
    throw new RequestError("INVALID_INPUT", 400);
  return {
    ...(input.id ? { id: uuid(input.id) } : {}),
    slug,
    name: text(input.name, 80),
    description: text(input.description, 240, false),
    location: text(input.location, 100, false),
    starts_at,
    ends_at,
    status: oneOf(input.status, ["draft", "published", "ended"]),
  };
}
export function parseBooth(value: unknown) {
  const input = object(value);
  if (
    typeof input.sort_order !== "number" ||
    !Number.isInteger(input.sort_order) ||
    input.sort_order < 0 ||
    input.sort_order > 9999 ||
    typeof input.is_active !== "boolean"
  )
    throw new RequestError("INVALID_INPUT", 400);
  return {
    ...(input.id ? { id: uuid(input.id) } : {}),
    event_id: uuid(input.event_id),
    name: text(input.name, 60),
    description: text(input.description, 160, false),
    location: text(input.location, 80, false),
    icon: oneOf(input.icon, [
      "coffee",
      "palette",
      "leaf",
      "camera",
      "music",
      "sparkles",
      "gift",
      "heart",
    ]),
    color: oneOf(input.color, [
      "peach",
      "lilac",
      "sage",
      "sky",
      "butter",
      "rose",
    ]),
    sort_order: input.sort_order,
    is_active: input.is_active,
  };
}

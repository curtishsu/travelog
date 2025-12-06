import { NextResponse } from 'next/server';

type JsonValue = Record<string, unknown>;

export function json<T extends JsonValue>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export function ok<T extends JsonValue>(body: T) {
  return json(body, { status: 200 });
}

export function created<T extends JsonValue>(body: T) {
  return json(body, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, issues?: JsonValue) {
  return json({ error: message, ...(issues ? { issues } : {}) }, { status: 400 });
}

export function unauthorized(message = 'Unauthorized') {
  return json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return json({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return json({ error: message }, { status: 404 });
}

export function serverError(message = 'Server error') {
  return json({ error: message }, { status: 500 });
}


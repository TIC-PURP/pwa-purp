import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const couchBase = process.env.COUCH_HOST!; // e.g. http://host:5984

function buildTarget(req: NextRequest, parts: string[]) {
  const path = parts.join("/");
  const qs = req.nextUrl.search || "";
  return `${couchBase}/${path}${qs}`;
}

async function forward(req: NextRequest, target: string, method: string) {
  const cookieHeader = cookies().toString();
  const headers: Record<string, string> = { cookie: cookieHeader };
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;

  const r = await fetch(target, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : req.body,
    redirect: "manual",
  });

  // Mirror status and pass-through body; keep important headers
  const resHeaders = new Headers();
  const copyHeaders = ["content-type", "etag", "cache-control"];
  for (const [k, v] of r.headers.entries()) {
    if (copyHeaders.includes(k.toLowerCase())) resHeaders.set(k, v);
  }
  return new NextResponse(r.body, { status: r.status, headers: resHeaders });
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, buildTarget(req, params.path), "GET");
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, buildTarget(req, params.path), "POST");
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, buildTarget(req, params.path), "PUT");
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, buildTarget(req, params.path), "DELETE");
}

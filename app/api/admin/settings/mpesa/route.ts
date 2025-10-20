import { NextRequest, NextResponse } from "next/server";

type MpesaSettings = {
  shortCode?: string;
  passkey?: string;
  consumerKey?: string;
  consumerSecret?: string;
  environment?: "sandbox" | "production";
  stkCallbackUrl?: string;
  c2bValidationUrl?: string;
  c2bConfirmationUrl?: string;
};

let inMemory: MpesaSettings | null = null;

function fromEnv(): MpesaSettings {
  return {
    shortCode: process.env.MPESA_SHORT_CODE || "",
    passkey: process.env.MPESA_PASSKEY ? "set" : "",
    consumerKey: process.env.MPESA_CONSUMER_KEY ? "set" : "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET ? "set" : "",
    environment: (process.env.MPESA_ENV as "sandbox" | "production") || "sandbox",
    stkCallbackUrl: process.env.MPESA_STK_CALLBACK_URL || "",
    c2bValidationUrl: process.env.MPESA_C2B_VALIDATION_URL || "",
    c2bConfirmationUrl: process.env.MPESA_C2B_CONFIRMATION_URL || "",
  };
}

function isAdmin(req: NextRequest): boolean {
  // Minimal placeholder authz (replace with real JWT/role check)
  const token = req.headers.get("x-admin-token");
  return !!token;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = inMemory ?? fromEnv();
  // basic audit log
  console.log("[mpesa-settings] GET", { ts: Date.now(), env: payload.environment });
  return NextResponse.json(payload);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as MpesaSettings;
    inMemory = {
      shortCode: body.shortCode || "",
      passkey: body.passkey || inMemory?.passkey || "",
      consumerKey: body.consumerKey || inMemory?.consumerKey || "",
      consumerSecret: body.consumerSecret || inMemory?.consumerSecret || "",
      environment: body.environment === "production" ? "production" : "sandbox",
      stkCallbackUrl: body.stkCallbackUrl || "",
      c2bValidationUrl: body.c2bValidationUrl || "",
      c2bConfirmationUrl: body.c2bConfirmationUrl || "",
    };
    // basic audit log
    console.log("[mpesa-settings] PUT", { ts: Date.now(), env: inMemory.environment });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid payload" }, { status: 400 });
  }
}



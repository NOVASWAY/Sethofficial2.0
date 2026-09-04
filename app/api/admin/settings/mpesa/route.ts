import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

const SETTINGS_KEY = "mpesa_settings";

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

async function getSettings(): Promise<MpesaSettings> {
  try {
    const record = await prisma.systemSetting.findUnique({
      where: { key: SETTINGS_KEY },
    });
    if (record) {
      return JSON.parse(record.value) as MpesaSettings;
    }
  } catch {
    // Fall through to env defaults
  }
  return fromEnv();
}

async function saveSettings(settings: MpesaSettings): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: {
      value: JSON.stringify(settings),
      category: "mpesa",
      description: "M-Pesa integration settings",
    },
    create: {
      key: SETTINGS_KEY,
      value: JSON.stringify(settings),
      category: "mpesa",
      description: "M-Pesa integration settings",
    },
  });
}

function isAdmin(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return !!token;
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await getSettings();
  return NextResponse.json(payload);
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as MpesaSettings;
    const current = await getSettings();
    const updated: MpesaSettings = {
      shortCode: body.shortCode || current.shortCode || "",
      passkey: body.passkey || current.passkey || "",
      consumerKey: body.consumerKey || current.consumerKey || "",
      consumerSecret: body.consumerSecret || current.consumerSecret || "",
      environment: body.environment === "production" ? "production" : "sandbox",
      stkCallbackUrl: body.stkCallbackUrl || current.stkCallbackUrl || "",
      c2bValidationUrl: body.c2bValidationUrl || current.c2bValidationUrl || "",
      c2bConfirmationUrl: body.c2bConfirmationUrl || current.c2bConfirmationUrl || "",
    };
    await saveSettings(updated);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid payload" }, { status: 400 });
  }
}

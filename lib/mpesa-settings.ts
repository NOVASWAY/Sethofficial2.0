export type MpesaSettings = {
  shortCode: string;
  passkey: string | "set" | "";
  consumerKey: string | "set" | "";
  consumerSecret: string | "set" | "";
  environment: "sandbox" | "production";
  stkCallbackUrl: string;
  c2bValidationUrl: string;
  c2bConfirmationUrl: string;
};

let cached: MpesaSettings | null = null;

export async function getMpesaSettings(adminToken?: string): Promise<MpesaSettings> {
  if (cached) return cached;
  const res = await fetch("/api/admin/settings/mpesa", {
    cache: "no-store",
    headers: {
      "x-admin-token": adminToken || process.env.NEXT_PUBLIC_ADMIN_TOKEN || "dev",
    },
  });
  if (!res.ok) throw new Error(`Failed to load M-Pesa settings (${res.status})`);
  const data = (await res.json()) as Partial<MpesaSettings>;
  cached = {
    shortCode: data.shortCode || "",
    passkey: data.passkey || "",
    consumerKey: data.consumerKey || "",
    consumerSecret: data.consumerSecret || "",
    environment: (data.environment as any) === "production" ? "production" : "sandbox",
    stkCallbackUrl: data.stkCallbackUrl || "",
    c2bValidationUrl: data.c2bValidationUrl || "",
    c2bConfirmationUrl: data.c2bConfirmationUrl || "",
  };
  return cached;
}

export function clearMpesaSettingsCache() {
  cached = null;
}



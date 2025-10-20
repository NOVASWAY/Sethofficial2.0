"use client";

import React from "react";

type MpesaSettings = {
  shortCode: string;
  passkey: string;
  consumerKey: string;
  consumerSecret: string;
  environment: "sandbox" | "production";
  stkCallbackUrl: string;
  c2bValidationUrl: string;
  c2bConfirmationUrl: string;
};

const initialValues: MpesaSettings = {
  shortCode: "",
  passkey: "",
  consumerKey: "",
  consumerSecret: "",
  environment: "sandbox",
  stkCallbackUrl: "",
  c2bValidationUrl: "",
  c2bConfirmationUrl: "",
};

export default function MpesaSettingsPage() {
  const [values, setValues] = React.useState<MpesaSettings>(initialValues);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [revealSecrets, setRevealSecrets] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setSaved(false);
        const res = await fetch("/api/admin/settings/mpesa", {
          cache: "no-store",
          headers: { "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN || "dev" },
        });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data) {
            setValues((prev) => ({
              ...prev,
              ...{
                shortCode: data.shortCode ?? "",
                passkey: data.passkey ? "••••••••" : "",
                consumerKey: data.consumerKey ? "••••••••" : "",
                consumerSecret: data.consumerSecret ? "••••••••" : "",
                environment: data.environment === "production" ? "production" : "sandbox",
                stkCallbackUrl: data.stkCallbackUrl ?? "",
                c2bValidationUrl: data.c2bValidationUrl ?? "",
                c2bConfirmationUrl: data.c2bConfirmationUrl ?? "",
              },
            }));
          }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load settings");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  function onChange<K extends keyof MpesaSettings>(key: K, val: MpesaSettings[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function displaySecret(value: string) {
    if (!value) return "";
    return revealSecrets ? value : "••••••••";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: MpesaSettings = {
        shortCode: values.shortCode.trim(),
        passkey: revealSecrets ? values.passkey.trim() : values.passkey.startsWith("•") ? "" : values.passkey.trim(),
        consumerKey: revealSecrets ? values.consumerKey.trim() : values.consumerKey.startsWith("•") ? "" : values.consumerKey.trim(),
        consumerSecret: revealSecrets ? values.consumerSecret.trim() : values.consumerSecret.startsWith("•") ? "" : values.consumerSecret.trim(),
        environment: values.environment,
        stkCallbackUrl: values.stkCallbackUrl.trim(),
        c2bValidationUrl: values.c2bValidationUrl.trim(),
        c2bConfirmationUrl: values.c2bConfirmationUrl.trim(),
      };

      // Basic client validation
      if (!payload.shortCode) throw new Error("Short Code is required");
      if (!payload.stkCallbackUrl) throw new Error("STK Callback URL is required");

      const res = await fetch("/api/admin/settings/mpesa", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": process.env.NEXT_PUBLIC_ADMIN_TOKEN || "dev",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>M-Pesa (Daraja) Settings</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        Configure your Daraja credentials and callback URLs. Secrets are masked by default.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Short Code (PayBill/Till)</span>
          <input
            value={values.shortCode}
            onChange={(e) => onChange("shortCode", e.target.value)}
            placeholder="eg. 174379"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Passkey</span>
          <input
            type={revealSecrets ? "text" : "password"}
            value={displaySecret(values.passkey)}
            onChange={(e) => onChange("passkey", e.target.value)}
            placeholder="Daraja LNM Passkey"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Consumer Key</span>
          <input
            type={revealSecrets ? "text" : "password"}
            value={displaySecret(values.consumerKey)}
            onChange={(e) => onChange("consumerKey", e.target.value)}
            placeholder="Daraja Consumer Key"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Consumer Secret</span>
          <input
            type={revealSecrets ? "text" : "password"}
            value={displaySecret(values.consumerSecret)}
            onChange={(e) => onChange("consumerSecret", e.target.value)}
            placeholder="Daraja Consumer Secret"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Environment</span>
          <select
            value={values.environment}
            onChange={(e) => onChange("environment", e.target.value as MpesaSettings["environment"])}
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>STK Callback URL</span>
          <input
            value={values.stkCallbackUrl}
            onChange={(e) => onChange("stkCallbackUrl", e.target.value)}
            placeholder="https://your-domain/api/payments/mpesa/callback"
          />
        </label>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>C2B Validation URL</span>
            <input
              value={values.c2bValidationUrl}
              onChange={(e) => onChange("c2bValidationUrl", e.target.value)}
              placeholder="https://your-domain/api/payments/mpesa/validate"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span>C2B Confirmation URL</span>
            <input
              value={values.c2bConfirmationUrl}
              onChange={(e) => onChange("c2bConfirmationUrl", e.target.value)}
              placeholder="https://your-domain/api/payments/mpesa/confirm"
            />
          </label>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={revealSecrets}
              onChange={(e) => setRevealSecrets(e.target.checked)}
            />
            <span>Reveal secrets</span>
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p style={{ color: "#b00020" }}>{error}</p>}
        {saved && <p style={{ color: "#066e29" }}>Settings saved.</p>}
      </form>
    </div>
  );
}



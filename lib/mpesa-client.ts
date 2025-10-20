import { getMpesaSettings } from "./mpesa-settings";

export type StkPushParams = {
  phone: string; // MSISDN in 2547XXXXXXXX format
  amount: number;
  accountReference?: string; // invoice id or visit id
  description?: string;
};

export async function buildStkPushPayload(params: StkPushParams, adminToken?: string) {
  const s = await getMpesaSettings(adminToken);
  return {
    BusinessShortCode: s.shortCode,
    Password: "<derived-at-runtime>", // build at request time on backend using passkey+shortCode+timestamp
    Timestamp: "<yyyyMMddHHmmss>",
    TransactionType: "CustomerPayBillOnline",
    Amount: params.amount,
    PartyA: params.phone,
    PartyB: s.shortCode,
    PhoneNumber: params.phone,
    CallBackURL: s.stkCallbackUrl,
    AccountReference: params.accountReference || "INVOICE",
    TransactionDesc: params.description || "Payment",
  };
}



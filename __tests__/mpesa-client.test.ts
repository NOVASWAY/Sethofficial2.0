import { buildStkPushPayload } from "../lib/mpesa-client";

// Mock fetch for settings
global.fetch = jest.fn(async () =>
  ({
    ok: true,
    json: async () => ({
      shortCode: "174379",
      passkey: "set",
      consumerKey: "set",
      consumerSecret: "set",
      environment: "sandbox",
      stkCallbackUrl: "https://cb.example/mpesa",
      c2bValidationUrl: "",
      c2bConfirmationUrl: "",
    }),
  } as any)
);

describe("mpesa-client", () => {
  it("builds STK payload with settings", async () => {
    const payload = await buildStkPushPayload({
      phone: "254712345678",
      amount: 1000,
      accountReference: "INV-123",
      description: "Consultation",
    }, "dev");

    expect(payload.BusinessShortCode).toBe("174379");
    expect(payload.Amount).toBe(1000);
    expect(payload.PhoneNumber).toBe("254712345678");
    expect(payload.CallBackURL).toBe("https://cb.example/mpesa");
    expect(payload.AccountReference).toBe("INV-123");
    expect(payload.TransactionType).toBe("CustomerPayBillOnline");
  });
});



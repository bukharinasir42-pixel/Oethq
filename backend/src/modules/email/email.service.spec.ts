import * as nodemailer from "nodemailer";
import type { AppConfig } from "../../common/app-config";
import { EmailService } from "./email.service";

jest.mock("nodemailer");

const createTransport = nodemailer.createTransport as unknown as jest.Mock;

function config(values: Record<string, string | undefined> = {}): AppConfig {
  return {
    get<T = string>(key: string, defaultValue?: T): T | undefined {
      const value = values[key];
      if (value === undefined || value === "") {
        return defaultValue;
      }
      return value as T;
    }
  };
}

const SES = { SES_SMTP_HOST: "email-smtp.us-east-1.amazonaws.com", SES_SMTP_USERNAME: "akid", SES_SMTP_PASSWORD: "sespass" };
const EE = { SMTP_HOST: "smtp.elasticemail.com", SMTP_USER: "euser", SMTP_PASSWORD: "epass" };
const FROM = { SMTP_FROM: "OET HQ <no-reply@oethq.com>" };

function transports(sesSend: jest.Mock, eeSend: jest.Mock) {
  createTransport.mockImplementation((opts: { host: string }) => ({
    sendMail: opts.host === SES.SES_SMTP_HOST ? sesSend : eeSend
  }));
}

describe("EmailService provider fallback", () => {
  beforeEach(() => createTransport.mockReset());

  it("delivers via SES first and does not touch ElasticEmail when SES succeeds", async () => {
    const ses = jest.fn().mockResolvedValue({});
    const ee = jest.fn().mockResolvedValue({});
    transports(ses, ee);
    const svc = new EmailService(config({ ...SES, ...EE, ...FROM }));
    const r = await svc.sendOtpEmail("a@b.com", "123456", "LOGIN");
    expect(r).toMatchObject({ delivered: true, provider: "ses" });
    expect(ses).toHaveBeenCalledTimes(1);
    expect(ee).not.toHaveBeenCalled();
  });

  it("falls back to ElasticEmail when SES fails", async () => {
    const ses = jest.fn().mockRejectedValue(new Error("ses down"));
    const ee = jest.fn().mockResolvedValue({});
    transports(ses, ee);
    const svc = new EmailService(config({ ...SES, ...EE, ...FROM }));
    const r = await svc.sendOtpEmail("a@b.com", "123456", "LOGIN");
    expect(r).toMatchObject({ delivered: true, provider: "elasticemail" });
    expect(ses).toHaveBeenCalledTimes(1);
    expect(ee).toHaveBeenCalledTimes(1);
  });

  it("throws when every provider fails", async () => {
    const ses = jest.fn().mockRejectedValue(new Error("ses down"));
    const ee = jest.fn().mockRejectedValue(new Error("ee down"));
    transports(ses, ee);
    const svc = new EmailService(config({ ...SES, ...EE, ...FROM }));
    await expect(svc.sendOtpEmail("a@b.com", "123456", "LOGIN")).rejects.toThrow("ee down");
  });

  it("uses only ElasticEmail when SES is not configured", async () => {
    const ee = jest.fn().mockResolvedValue({});
    createTransport.mockImplementation(() => ({ sendMail: ee }));
    const svc = new EmailService(config({ ...EE, ...FROM }));
    const r = await svc.sendOtpEmail("a@b.com", "123456", "LOGIN");
    expect(r).toMatchObject({ delivered: true, provider: "elasticemail" });
    expect(ee).toHaveBeenCalledTimes(1);
  });

  it("logs a preview (no send) when no provider is configured", async () => {
    const svc = new EmailService(config({ ...FROM }));
    const r = await svc.sendOtpEmail("a@b.com", "123456", "LOGIN");
    expect(r).toMatchObject({ delivered: false, preview: true });
    expect(createTransport).not.toHaveBeenCalled();
  });
});

"use client";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";

export function DesignSystemOtpDemo() {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-6 shadow-sm">
      <Label htmlFor="otp" className="text-foreground">
        Verification code
      </Label>
      <p className="text-sm text-muted-foreground">Six digits sent to your email.</p>
      <InputOTP maxLength={6} id="otp" containerClassName="gap-2">
        <InputOTPGroup>
          <InputOTPSlot index={0} />
          <InputOTPSlot index={1} />
          <InputOTPSlot index={2} />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot index={3} />
          <InputOTPSlot index={4} />
          <InputOTPSlot index={5} />
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

const fs = require("fs");
const p = "src/modules/auth/auth.service.ts";
let c = fs.readFileSync(p, "utf8");

const start = c.indexOf("    const code = await this.createOtpRecord(user.id, purpose);");
const endMarker = "  private requiresEmailVerification";
const end = c.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const replacement = `    const code = await this.createOtpRecord(user.id, purpose);
    try {
      const result = await this.dispatchOtpEmail(user.email, purpose, code, options);
      this.logger.log(
        \`OTP email for \${user.email} (\${purpose}) provider=\${result.provider || "none"} delivered=\${result.delivered}\`
      );
      if (!result.delivered && purpose === OTPPurpose.SUBSCRIPTION_ACTIVATION) {
        throw new Error("Activation email was not delivered by any SMTP provider");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(\`OTP email failed for \${user.email} (\${purpose}): \${detail}\`);
      if (purpose === OTPPurpose.SUBSCRIPTION_ACTIVATION) {
        throw error instanceof Error ? error : new Error(detail);
      }
    }
    return code;
  }

`;

c = c.slice(0, start) + replacement + c.slice(end);
fs.writeFileSync(p, c);
console.log("fixed issueOtpForUser");

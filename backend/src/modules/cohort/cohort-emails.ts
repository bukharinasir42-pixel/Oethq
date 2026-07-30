/**
 * cohort-emails.ts — HTML/text builders for cohort notifications.
 * Delivered via EmailService.sendCohortMail (see PATCHES.md — a small public
 * wrapper around the existing private sendMail, reusing SES/ElasticEmail).
 */

type Mail = { subject: string; text: string; html: string };

const wrap = (title: string, bodyHtml: string) => `<!DOCTYPE html>
<html><body style="margin:0;background:#F6F8FB;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E4EAF2">
  <tr><td style="background-color:#0F4C9A;padding:26px 34px">
    <div style="color:#fff;font-size:19px;font-weight:bold">OET HQ</div>
    <div style="color:#BFD6F2;font-size:11px;letter-spacing:1px;margin-top:4px">${title}</div>
  </td></tr>
  <tr><td style="padding:30px 34px">${bodyHtml}</td></tr>
  <tr><td style="padding:16px 34px;border-top:1px solid #E4EAF2;font-size:11px;color:#8595AB">
    OET HQ · oethq.com · Manage your class times any time in your portal.
  </td></tr>
</table></td></tr></table></body></html>`;

const cta = (url: string, label: string) => `
<table cellpadding="0" cellspacing="0"><tr><td style="background:#1465C8;border-radius:10px">
<a href="${url}" style="display:inline-block;padding:13px 28px;color:#fff;text-decoration:none;font-weight:bold;font-size:14px">${label}</a>
</td></tr></table>`;

export function buildSessionReminderEmail(p: {
  name: string; classLabel: string; title: string; localTime: string; portalUrl: string;
}): Mail {
  return {
    subject: `⏰ Your OET class starts in 30 minutes — ${p.localTime}`,
    text: `${p.name}, your ${p.classLabel} "${p.title}" starts in 30 minutes (${p.localTime}). Join: ${p.portalUrl}`,
    html: wrap("CLASS REMINDER", `
      <div style="font-size:16px;color:#12233B"><b>Assalamualaikum ${p.name},</b></div>
      <div style="font-size:14px;color:#5A6B82;line-height:1.6;margin-top:12px">
        Your class starts in <b style="color:#12233B">30 minutes</b> — at <b style="color:#0F4C9A">${p.localTime}</b>.
      </div>
      <div style="background:#F0F6FD;border:1px solid #E3EEFB;border-radius:12px;padding:15px 19px;margin:18px 0">
        <div style="font-size:11px;color:#5A6B82">${p.classLabel}</div>
        <div style="font-size:15px;color:#12233B;font-weight:bold;margin-top:4px">${p.title}</div>
      </div>
      ${cta(p.portalUrl, "Join Session →")}`)
  };
}

export function buildMissedSessionEmail(p: {
  name: string; title: string; localTime: string; portalUrl: string;
}): Mail {
  return {
    subject: `You missed today's class — the recording is waiting for you`,
    text: `${p.name}, you missed "${p.title}" (${p.localTime}). Watch the recording: ${p.portalUrl}`,
    html: wrap("MISSED SESSION", `
      <div style="font-size:16px;color:#12233B"><b>${p.name}, we saved your seat.</b></div>
      <div style="font-size:14px;color:#5A6B82;line-height:1.6;margin-top:12px">
        Your session <b>"${p.title}"</b> ran at ${p.localTime} and you couldn't make it — that's okay.
        The full recording is in <b>Pending Catch-up</b>, in the same place, ready when you are.
      </div>
      <div style="margin-top:18px">${cta(p.portalUrl, "Watch Recording →")}</div>`)
  };
}

export function buildWarningEmail(p: {
  name: string; missedCount: number; strong: boolean; portalUrl: string;
}): Mail {
  return {
    subject: p.strong
      ? `⚠️ ${p.name}, 3 study days missed — your cohort seat is waiting`
      : `${p.name}, you've missed 2 study days in a row`,
    text: `${p.name}, you have missed ${p.missedCount} consecutive study days. Catch up: ${p.portalUrl}`,
    html: wrap(p.strong ? "⚠️ ATTENDANCE WARNING" : "ATTENDANCE REMINDER", `
      <div style="font-size:16px;color:#12233B"><b>${p.name}, your seat is waiting for you.</b></div>
      <div style="font-size:14px;color:#5A6B82;line-height:1.6;margin-top:12px">
        You've missed your last <b style="color:#C22B2B">${p.missedCount} study days</b>.
        Every missed class is still available — recordings play right on the same day card,
        and completing them moves your pending work back to done.
      </div>
      <div style="background:#FFF3E0;border:1px solid #F5DCB2;border-radius:12px;padding:14px 18px;margin:18px 0;font-size:13px;color:#12233B;line-height:1.6">
        Students who attend 90%+ of cohort classes score on average one full band higher.
        Don't let ${p.missedCount} days become thirty.
      </div>
      ${cta(p.portalUrl, "Catch up now →")}
      <div style="font-size:13px;color:#5A6B82;margin-top:18px">— Dr Nasir Bukhari &amp; the OET HQ Team</div>`)
  };
}

export function buildWeeklyReportEmail(p: {
  name: string; sessionsScheduled: number; sessionsAttended: number; sessionsMissed: number;
  attendancePct: number; avgActiveWatchMin: number; currentStreak: number;
  pendingCatchUp: number; reportUrl: string;
}): Mail {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 0;border-bottom:1px dashed #E4EAF2;font-size:13px;color:#5A6B82">${k}</td>
     <td style="padding:8px 0;border-bottom:1px dashed #E4EAF2;font-size:13px;color:#12233B;font-weight:bold;text-align:right">${v}</td></tr>`;
  return {
    subject: `📊 Your Weekly Progress Report — ${p.attendancePct}% attendance`,
    text: `${p.name}, weekly report: ${p.sessionsAttended}/${p.sessionsScheduled} sessions attended (${p.attendancePct}%), streak ${p.currentStreak}, pending ${p.pendingCatchUp}. ${p.reportUrl}`,
    html: wrap("WEEKLY PROGRESS REPORT", `
      <div style="font-size:16px;color:#12233B"><b>${p.name}, here's your week at a glance.</b></div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">
        ${row("Sessions attended", `${p.sessionsAttended} of ${p.sessionsScheduled}`)}
        ${row("Attendance", `${p.attendancePct}%`)}
        ${row("Sessions missed", String(p.sessionsMissed))}
        ${row("Average active watch time", `${p.avgActiveWatchMin} min`)}
        ${row("Current streak", `${p.currentStreak} days`)}
        ${row("Pending catch-up", String(p.pendingCatchUp))}
      </table>
      ${cta(p.reportUrl, "View full report →")}`)
  };
}

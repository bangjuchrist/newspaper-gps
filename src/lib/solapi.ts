import { SolapiMessageService } from "solapi";

interface ReportNotificationParams {
  to: string;
  distributorName: string;
  teamName: string;
  region: string;
  delivered: number;
  remaining: number;
  date: string;
  notes?: string;
}

export async function sendReportNotification(params: ReportNotificationParams) {
  const {
    to, distributorName, teamName, region,
    delivered, remaining, date, notes,
  } = params;

  const dateLabel = new Date(date).toLocaleDateString("ko-KR", {
    month: "long", day: "numeric",
  });

  const text = [
    `[신문GPS] ${dateLabel} 배포 완료`,
    ``,
    `배포자: ${distributorName} (${region} ${teamName})`,
    `배포: ${delivered}부 / 잔여: ${remaining}부`,
    notes ? `특이사항: ${notes}` : null,
  ].filter(Boolean).join("\n");

  const messageService = new SolapiMessageService(
    process.env.SOLAPI_API_KEY!,
    process.env.SOLAPI_API_SECRET!
  );
  try {
    await messageService.send({
      to,
      from: process.env.SOLAPI_SENDER_PHONE!,
      text,
    });
    return { ok: true };
  } catch (err) {
    console.error("SOLAPI 전송 실패:", err);
    return { ok: false, error: err };
  }
}

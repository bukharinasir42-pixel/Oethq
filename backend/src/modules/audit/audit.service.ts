import { createLogger } from "../../common/logger";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import type { RequestAuditContext } from "../../common/http/request-context";
import { ListAuditLogsDto } from "./dto/list-audit-logs.dto";

type AuditRecordInput = RequestAuditContext & {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export class AuditService {
  private readonly logger = createLogger("AuditService");

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditRecordInput) {
    const payload = {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId || null,
      actorUserId: event.actorUserId || null,
      actorEmail: event.actorEmail || null,
      route: event.route || null,
      ipAddress: event.ipAddress || null,
      userAgent: event.userAgent || null,
      metadata: event.metadata
    };

    try {
      await this.prisma.auditLog.create({
        data: payload
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit event ${event.action}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    this.logger.log(JSON.stringify({ type: "audit", timestamp: new Date().toISOString(), ...payload }));
  }

  list(query: ListAuditLogsDto) {
    return this.prisma.auditLog.findMany({
      where: {
        action: query.action,
        entityType: query.entityType,
        actorUserId: query.actorUserId
      },
      orderBy: { createdAt: "desc" },
      take: query.limit ?? 25
    });
  }
}

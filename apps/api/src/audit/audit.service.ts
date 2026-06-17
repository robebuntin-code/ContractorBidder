import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorUserId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
}

/**
 * Append-only audit trail for sensitive actions (bid acceptance, payments,
 * location reveal). Accepts an optional Prisma transaction client so the audit
 * row commits atomically with the action it records.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    this.logger.log(`${entry.action} ${entry.entity}:${entry.entityId ?? '-'}`);
    return client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        meta: entry.meta,
      },
    });
  }
}

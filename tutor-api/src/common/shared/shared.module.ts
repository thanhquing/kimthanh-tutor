import { Global, Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { NotificationService } from './notification.service';
import { AccessService } from './access.service';
import { AuditService } from './audit.service';
import { MediaService } from './media.service';
import { PaidFeatureService } from './paid-feature.service';

// Dịch vụ dùng chung xuyên module (PrismaModule đã @Global nên inject được).
@Global()
@Module({
  providers: [
    OutboxService,
    NotificationService,
    AccessService,
    AuditService,
    MediaService,
    PaidFeatureService,
  ],
  exports: [
    OutboxService,
    NotificationService,
    AccessService,
    AuditService,
    MediaService,
    PaidFeatureService,
  ],
})
export class SharedModule {}

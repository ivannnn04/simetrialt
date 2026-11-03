-- Gmail mailboxes connected with an app password (IMAP + SMTP) and the e-mails exchanged with CRM clients.
-- Additive only: two new tables, nothing existing is changed.
CREATE TABLE "Mailbox" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "passwordEnc" TEXT NOT NULL,
    "imapHost" TEXT NOT NULL DEFAULT 'imap.gmail.com',
    "smtpHost" TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    "ownerUserId" TEXT,
    "syncState" JSONB NOT NULL DEFAULT '{}',
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "syncStartedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mailbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Mailbox_email_key" ON "Mailbox"("email");
ALTER TABLE "Mailbox" ADD CONSTRAINT "Mailbox_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "leadId" TEXT,
    "direction" TEXT NOT NULL,
    "fromAddr" TEXT NOT NULL,
    "fromName" TEXT NOT NULL DEFAULT '',
    "toAddrs" TEXT[],
    "ccAddrs" TEXT[],
    "subject" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL,
    "textBody" TEXT NOT NULL DEFAULT '',
    "snippet" TEXT NOT NULL DEFAULT '',
    "inReplyTo" TEXT,
    "references" TEXT NOT NULL DEFAULT '',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailMessage_mailboxId_messageId_key" ON "EmailMessage"("mailboxId", "messageId");
CREATE INDEX "EmailMessage_leadId_date_idx" ON "EmailMessage"("leadId", "date");
CREATE INDEX "EmailMessage_fromAddr_idx" ON "EmailMessage"("fromAddr");
CREATE INDEX "EmailMessage_toAddrs_idx" ON "EmailMessage" USING GIN ("toAddrs");
CREATE INDEX "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "Mailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

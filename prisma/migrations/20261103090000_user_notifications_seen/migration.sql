-- When each staff member last opened the notifications; newer website inquiries count as unread.
ALTER TABLE "User" ADD COLUMN "notificationsSeenAt" TIMESTAMP(3);

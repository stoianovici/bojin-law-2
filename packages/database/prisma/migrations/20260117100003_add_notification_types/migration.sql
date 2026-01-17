-- AlterEnum - Add new notification types
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EmailMadePublic';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DocumentMadePublic';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NewEmailWithAttachments';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NewTaskAssigned';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NewEventAssigned';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NewDocumentUploaded';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NewMapaCreated';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MapaCompleted';

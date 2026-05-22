import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import prisma from '../../config/db';
import { config } from '../../config/env';
import { UpdateProfileRequest } from './users.types';
import { Feature, AccessType } from '@prisma/client';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKey,
    secretAccessKey: config.r2SecretKey,
  },
});

export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId, is_deleted: false },
      select: {
        id: true,
        name: true,
        email: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        profile_photo_url: true,
        created_at: true,
        updated_at: true,
        push_token: true,
        courses: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const admin = await prisma.admin.findUnique({
      where: { email: user.email },
      select: { role: true }
    });

    return { ...user, admin_role: admin?.role || null };
  }

  async updateProfile(userId: string, data: UpdateProfileRequest) {
    return prisma.user.update({
      where: { id: userId, is_deleted: false },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        university: true,
        faculty: true,
        department: true,
        level: true,
        profile_photo_url: true,
        created_at: true,
        updated_at: true,
        push_token: true,
        courses: true,
      },
    });
  }

  async uploadPhoto(userId: string, file: Express.Multer.File) {
    const fileKey = `profile-photos/${userId}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    const photoUrl = `${config.r2PublicUrl}/${fileKey}`;

    await prisma.user.update({
      where: { id: userId },
      data: { profile_photo_url: photoUrl },
    });

    return { photoUrl };
  }

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile_photo_url: true },
    });

    if (user?.profile_photo_url) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: config.r2BucketName,
            Key: `profile-photos/${userId}`,
          })
        );
      } catch (error) {
        console.error('Failed to delete photo from R2:', error);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        is_deleted: true,
        profile_photo_url: null,
      },
    });

    await prisma.refreshToken.updateMany({
      where: { user_id: userId },
      data: { is_active: false },
    });
  }

  async getLearningProfile(userId: string) {
    return prisma.learningProfile.findUnique({
      where: { user_id: userId },
    });
  }

  async getSessions(userId: string) {
    return prisma.session.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async getDevices(userId: string) {
    return prisma.refreshToken.findMany({
      where: { user_id: userId, is_active: true },
      select: {
        id: true,
        device_name: true,
        device_type: true,
        created_at: true,
      },
    });
  }

  async logoutDevice(userId: string, deviceId: string) {
    const result = await prisma.refreshToken.updateMany({
      where: { id: deviceId, user_id: userId },
      data: { is_active: false },
    });

    if (result.count === 0) {
      throw new Error('Device not found or already logged out');
    }
  }

  async getFeatureAccess(userId: string) {
    if (config.unlockAllFeatures) {
      return Object.values(Feature).map((feature) => ({
        id: 'bypassed',
        user_id: userId,
        feature,
        access_type: AccessType.TIME_WINDOW,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        uses_remaining: null,
        purchased_at: new Date(),
        payment_ref: 'BYPASS',
      }));
    }

    return prisma.featureAccess.findMany({
      where: { user_id: userId },
    });
  }

  async getUploads(userId: string) {
    return prisma.material.findMany({
      where: { uploaded_by: userId },
    });
  }
}

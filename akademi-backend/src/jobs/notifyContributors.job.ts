import prisma from '../config/db';
import { Resend } from 'resend';
import { config } from '../config/env';

const resend = new Resend(config.resendApiKey);

export async function notifyContributorsJob(materialId: string) {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
  });

  if (!material) throw new Error('Material not found');

  const contributorIds = (material.contributor_ids as string[]) || [];

  const users = await prisma.user.findMany({
    where: { id: { in: contributorIds } },
    select: { email: true, name: true },
  });

  for (const user of users) {
    try {
      await resend.emails.send({
        from: 'Akademi <noreply@akademi.edu.ng>',
        to: user.email,
        subject: `Material Verified: ${material.title}`,
        html: `<p>Hello ${user.name},</p>
               <p>The material you contributed to, <strong>${material.title}</strong> (${material.course_code}), has been verified and published to the national library.</p>
               <p>Thank you for contributing to the Akademi community!</p>`,
      });
      console.log(
        `Notification sent to ${user.email} for material ${materialId}`,
      );
    } catch (error) {
      console.error(`Failed to send email to ${user.email}: `, error);
    }
  }
}

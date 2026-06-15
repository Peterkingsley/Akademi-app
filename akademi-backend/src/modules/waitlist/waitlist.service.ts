import prisma from '../../config/db';
import { Prisma } from '@prisma/client';
import { JoinWaitlistRequest } from './waitlist.types';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value?: string) {
  return typeof value === 'string' ? value.trim() : undefined;
}

function parseLevel(value?: number | string) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

export class WaitlistService {
  async join(data: JoinWaitlistRequest) {
    const fullName = clean(data.full_name);
    const email = clean(data.email)?.toLowerCase();
    const metadata = {
      ...(data.metadata || {}),
      faculty: clean(data.faculty) || (data.metadata || {}).faculty || null,
    } as Prisma.InputJsonValue;

    if (!fullName || fullName.length < 2) {
      throw new Error('Full name is required.');
    }

    if (!email || !emailRegex.test(email)) {
      throw new Error('A valid email address is required.');
    }

    const entry = await prisma.waitlistEntry.upsert({
      where: { email },
      create: {
        full_name: fullName,
        email,
        phone: clean(data.phone) || null,
        university: clean(data.university) || null,
        department: clean(data.department) || null,
        level: parseLevel(data.level),
        main_struggle: clean(data.main_struggle) || null,
        source: clean(data.source) || 'landing_page',
        metadata,
      },
      update: {
        full_name: fullName,
        phone: clean(data.phone) || null,
        university: clean(data.university) || null,
        department: clean(data.department) || null,
        level: parseLevel(data.level),
        main_struggle: clean(data.main_struggle) || null,
        source: clean(data.source) || 'landing_page',
        metadata,
        status: 'WAITLISTED',
      },
    });

    return {
      id: entry.id,
      email: entry.email,
      status: entry.status,
      message: 'You are on the Akademi beta waitlist.',
    };
  }
}

export const waitlistService = new WaitlistService();

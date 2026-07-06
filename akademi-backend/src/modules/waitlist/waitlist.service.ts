import prisma from '../../config/db';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { JoinWaitlistRequest, WaitlistEventRequest } from './waitlist.types';

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

function cleanNullable(value?: string | null) {
  const result = clean(value ?? undefined);
  return result || null;
}

function detectDeviceType(userAgent?: string | null) {
  const normalized = String(userAgent || '').toLowerCase();
  if (!normalized) return 'unknown';
  if (/ipad|tablet/.test(normalized)) return 'tablet';
  if (/mobile|android|iphone|ipod/.test(normalized)) return 'mobile';
  return 'desktop';
}

function hashIp(ip?: string | null) {
  const normalized = clean(ip ?? undefined);
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

const ALLOWED_WAITLIST_EVENTS = new Set([
  'waitlist_page_view',
  'waitlist_form_started',
  'waitlist_school_search',
  'waitlist_school_selected',
  'waitlist_submit_success',
  'waitlist_redirect_whatsapp',
]);

export class WaitlistService {
  async join(data: JoinWaitlistRequest) {
    const fullName = clean(data.full_name);
    const email = clean(data.email)?.toLowerCase();
    const metadataFaculty = (data.metadata || {}).faculty;
    const faculty = clean(data.faculty) || (typeof metadataFaculty === 'string' ? clean(metadataFaculty) : undefined);
    const metadata = {
      ...(data.metadata || {}),
      faculty: faculty || null,
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
        faculty: faculty || null,
        department: clean(data.department) || null,
        level: parseLevel(data.level),
        main_struggle: clean(data.main_struggle) || null,
        source: clean(data.source) || 'landing_page',
        utm_source: clean(data.utm_source) || null,
        utm_medium: clean(data.utm_medium) || null,
        utm_campaign: clean(data.utm_campaign) || null,
        metadata,
      },
      update: {
        full_name: fullName,
        phone: clean(data.phone) || null,
        university: clean(data.university) || null,
        faculty: faculty || null,
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

  async trackEvent(data: WaitlistEventRequest, context?: { userAgent?: string | null; ip?: string | null; referrer?: string | null }) {
    const eventName = clean(data.event_name);
    const visitorId = clean(data.visitor_id);

    if (!eventName || !ALLOWED_WAITLIST_EVENTS.has(eventName)) {
      throw new Error('Unsupported waitlist event.');
    }

    if (!visitorId || visitorId.length < 8) {
      throw new Error('Visitor id is required.');
    }

    const safeMetadata = {
      ...(data.metadata || {}),
    } as Prisma.InputJsonValue;

    await prisma.waitlistEvent.create({
      data: {
        event_name: eventName,
        visitor_id: visitorId,
        session_id: cleanNullable(data.session_id),
        page_url: cleanNullable(data.page_url),
        page_path: cleanNullable(data.page_path),
        referrer: cleanNullable(data.referrer) || cleanNullable(context?.referrer),
        utm_source: cleanNullable(data.utm_source),
        utm_medium: cleanNullable(data.utm_medium),
        utm_campaign: cleanNullable(data.utm_campaign),
        utm_content: cleanNullable(data.utm_content),
        utm_term: cleanNullable(data.utm_term),
        school_query: cleanNullable(data.school_query),
        school_name: cleanNullable(data.school_name),
        ip_hash: hashIp(context?.ip),
        user_agent: cleanNullable(context?.userAgent),
        device_type: detectDeviceType(context?.userAgent),
        metadata: safeMetadata,
      },
    });

    return { ok: true };
  }
}

export const waitlistService = new WaitlistService();

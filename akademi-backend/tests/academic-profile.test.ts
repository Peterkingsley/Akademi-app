import { isAcademicProfileComplete, normalizePhoneNumber } from '../src/shared/utils/academic-profile';

describe('academic profile helpers', () => {
  it('requires all core academic fields', () => {
    expect(isAcademicProfileComplete({ university: 'UNILAG', faculty: 'Science', department: 'Computer Science', level: 200 })).toBe(true);
    expect(isAcademicProfileComplete({ university: 'UNILAG', faculty: 'Science', department: 'Computer Science', level: null })).toBe(false);
  });

  it('normalizes Nigerian numbers without rejecting E.164 numbers', () => {
    expect(normalizePhoneNumber('08012345678')).toBe('+2348012345678');
    expect(normalizePhoneNumber('+447700900123')).toBe('+447700900123');
    expect(normalizePhoneNumber('not-a-phone')).toBeNull();
  });
});

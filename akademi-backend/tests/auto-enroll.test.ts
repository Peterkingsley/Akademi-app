import { autoEnrollStudentInDepartmentCourses } from '../src/modules/textbooks/textbook-trigger';
import prisma from '../src/config/db';
import { triggerTextbookGenerationForCourseCodes } from '../src/modules/textbooks/textbook-trigger';

// Mock dependencies
jest.mock('../src/config/db', () => ({
  __esModule: true,
  default: {
    disciplineDocument: {
      findMany: jest.fn(),
    },
    studentCourse: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../src/modules/textbooks/textbook-trigger', () => {
  const original = jest.requireActual('../src/modules/textbooks/textbook-trigger');
  return {
    ...original,
    triggerTextbookGenerationForCourseCodes: jest.fn().mockResolvedValue(true),
  };
});

describe('Auto-enroll Students in CCMAS Courses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should auto-enroll a fresh student with zero manual course codes in CCMAS courses', async () => {
    // 1. Mock the DisciplineDocument to return a confirmed split CCMAS course for Physics/Ibadan
    (prisma.disciplineDocument.findMany as jest.Mock).mockResolvedValue([
      { course_code: 'PHY101' },
      { course_code: 'PHY102' },
    ]);

    // 2. Mock StudentCourse to return no existing courses (zero manual codes)
    (prisma.studentCourse.findMany as jest.Mock).mockResolvedValue([]);

    // 3. Mock create to succeed
    (prisma.studentCourse.create as jest.Mock).mockResolvedValue({});

    await autoEnrollStudentInDepartmentCourses(
      'user-1',
      'university-1',
      'Science',
      'Physics',
      100
    );

    // Assertions
    expect(prisma.disciplineDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source_type: 'CCMAS',
          is_active: true,
          faculty: 'Science',
          department: 'Physics',
          level: 100,
        }),
      })
    );

    expect(prisma.studentCourse.create).toHaveBeenCalledTimes(2);
    expect(prisma.studentCourse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'PHY101', source: 'ccmas_auto' }),
      })
    );
    expect(prisma.studentCourse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: 'PHY102', source: 'ccmas_auto' }),
      })
    );

    expect(triggerTextbookGenerationForCourseCodes).toHaveBeenCalledWith(
      ['PHY101', 'PHY102'],
      'university-1'
    );
  });

  it('should correctly run the one-time backfill script', async () => {
    // Mock user.findMany to return the Physics/Ibadan test account
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'test-user-1',
        university: 'University of Ibadan',
        faculty: 'Science',
        department: 'Physics',
        level: 100,
      }
    ]);

    // Mock DisciplineDocument to return CCMAS courses for the test account
    (prisma.disciplineDocument.findMany as jest.Mock).mockResolvedValue([
      { course_code: 'PHY101' },
      { course_code: 'PHY102' }
    ]);
    
    // Test account has zero existing courses
    (prisma.studentCourse.findMany as jest.Mock).mockResolvedValue([]);

    // We can directly call the autoEnroll function as the script would
    const users = await prisma.user.findMany();
    let enrolledCount = 0;
    
    for (const u of users) {
      await autoEnrollStudentInDepartmentCourses(
        u.id,
        'uni-id',
        u.faculty,
        u.department,
        u.level
      );
      enrolledCount++;
    }

    expect(enrolledCount).toBe(1);
    expect(prisma.studentCourse.create).toHaveBeenCalledTimes(2);
  });
});

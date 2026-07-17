import { Request, Response } from 'express';
import { UniversitiesService } from './universities.service';

const universitiesService = new UniversitiesService();

export class UniversitiesController {
  async getUniversities(req: Request, res: Response) {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const universities = await universitiesService.getAllUniversities(search, limit);
      res.status(200).json(universities);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch universities' });
    }
  }

  async getFaculties(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const faculties = await universitiesService.getFacultiesByUniversity(id);
      res.status(200).json(faculties);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch faculties' });
    }
  }

  async getDepartments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const faculty = typeof req.query.faculty === 'string' ? req.query.faculty : undefined;
      const departments = await universitiesService.getDepartmentsByUniversity(id, faculty);
      res.status(200).json(departments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch departments' });
    }
  }

  async requestUniversity(req: Request, res: Response) {
    try {
      const query = typeof req.body.query === 'string' ? req.body.query.trim() : '';
      const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

      if (!query) {
        res.status(400).json({ message: 'Tell us the name of your school.' });
        return;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ message: 'Enter a valid email address.' });
        return;
      }

      await universitiesService.requestUniversity(query, email);
      res.status(201).json({ message: 'Request received.' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to submit school request' });
    }
  }

  async getCourseSuggestions(req: Request, res: Response) {
    try {
      const { departmentId } = req.params;
      const level = req.query.level ? Number(req.query.level) : undefined;
      const semester = req.query.semester ? Number(req.query.semester) : undefined;
      const courses = await universitiesService.getCourseSuggestions(departmentId, level, semester);
      res.status(200).json(courses);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch course suggestions' });
    }
  }
}

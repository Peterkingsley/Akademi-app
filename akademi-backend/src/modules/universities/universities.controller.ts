import { Request, Response } from 'express';
import { UniversitiesService } from './universities.service';

const universitiesService = new UniversitiesService();

export class UniversitiesController {
  async getUniversities(req: Request, res: Response) {
    try {
      const universities = await universitiesService.getAllUniversities();
      res.status(200).json(universities);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch universities' });
    }
  }

  async getDepartments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const departments = await universitiesService.getDepartmentsByUniversity(id);
      res.status(200).json(departments);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch departments' });
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

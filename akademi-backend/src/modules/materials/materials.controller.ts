import { Request, Response } from 'express';
import { MaterialsService } from './materials.service';

const materialsService = new MaterialsService();

export class MaterialsController {
  async list(req: Request, res: Response) {
    try {
      const materials = await materialsService.listMaterials(req.query);
      res.status(200).json(materials);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async getOne(req: Request, res: Response) {
    try {
      const material = await materialsService.getMaterial(req.params.id, {
        requestingUserId: req.user!.userId,
      });
      res.status(200).json(material);
    } catch (error: any) {
      const status = error.message === 'Material not found' ? 404 : 403;
      res.status(status).json({ message: error.message });
    }
  }

  async upload(req: Request, res: Response) {
    try {
      const result = await materialsService.createUpload(req.user!.userId, req.body);
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async confirm(req: Request, res: Response) {
    try {
      const result = await materialsService.confirmUpload(req.params.id, req.user!.userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getDownloadUrl(req: Request, res: Response) {
    try {
      const url = await materialsService.getDownloadUrl(req.params.id, {
        requestingUserId: req.user!.userId,
      });
      res.status(200).json({ url });
    } catch (error: any) {
      const status = error.message === 'Material not found' ? 404 : 403;
      res.status(status).json({ message: error.message });
    }
  }

  async getQuestions(req: Request, res: Response) {
    try {
      const questions = await materialsService.getQuestions(
        req.params.id,
        req.user!.userId,
        req.query.limit ? Number(req.query.limit) : undefined,
      );
      res.status(200).json(questions);
    } catch (error: any) {
      if (error.message === 'Material CBT Day Pass required') {
        return res.status(403).json({
          message: error.message,
          productCode: 'MATERIAL_CBT_DAY_PASS',
          scopeType: 'MATERIAL',
          scopeId: req.params.id,
        });
      }
      res.status(404).json({ message: error.message });
    }
  }

  async submitQuestionAttempts(req: Request, res: Response) {
    try {
      const result = await materialsService.submitQuestionAttempts(
        req.params.id,
        req.user!.userId,
        Array.isArray(req.body?.answers) ? req.body.answers : [],
      );
      res.status(201).json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async report(req: Request, res: Response) {
    try {
      await materialsService.reportMaterial(req.params.id, req.user!.userId, req.body);
      res.status(200).json({ message: 'Material reported successfully' });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getPending(req: Request, res: Response) {
    try {
      const pending = await materialsService.getPendingUploads(req.user!.userId);
      res.status(200).json(pending);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

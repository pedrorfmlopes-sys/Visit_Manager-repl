import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import {getUserContext} from '../authContext';
import {pool} from '../db';
import {ContactAccessService} from '../contactAccessService';
import {storage} from '../storage';
import { isAuthenticated } from "../replitAuth";
import {
  isUploadOwnedByEmpresa,
  legacyUploadsDir,
  uploadsDir,
} from "../uploads";

const router = Router();

/**
 * GET /uploads/:filename
 * Serve apenas ficheiros referenciados por dados da empresa autenticada.
 */
router.get("/:filename", isAuthenticated, async (req: Request, res: Response) => {
  const { filename } = req.params;
  const empresaId = (req as any).session?.user?.empresaId;

  if (!filename) {
    return res.status(400).json({ message: "Missing filename" });
  }
  if (!empresaId) {
    return res.status(403).json({ message: "User has no company assigned" });
  }

  const safeFilename = path.basename(filename);
  if (safeFilename !== filename) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  if (!(await isUploadOwnedByEmpresa(safeFilename, empresaId))) {
    return res.status(404).json({ message: "File not found" });
  }

  if(process.env.CONTACT_ACCESS_V2==='true') {
    try {
      const context=await getUserContext(req);
      if(context.empresaId!==empresaId)return res.status(404).json({message:'File not found'});
      if(context.userRole!=='admin') {
        const urls=[`/uploads/${safeFilename}`,`/api/uploads/${safeFilename}`];
        const entities=(await pool.query('SELECT id FROM entidades WHERE empresa_id=$1 AND logo_url=ANY($2::text[])',[empresaId,urls])).rows;
        const visits=(await pool.query(`SELECT id FROM visitas WHERE empresa_id=$1 AND (audio_url=ANY($2::text[]) OR media_urls && $2::text[])
          UNION SELECT visita_id AS id FROM visitas_audio WHERE empresa_id=$1 AND file_url=ANY($2::text[])`,[empresaId,urls])).rows;
        const access=new ContactAccessService(pool);
        for(const entity of entities)if(!await access.allowed(context.userId,'entity',entity.id))return res.status(404).json({message:'File not found'});
        for(const visit of visits)if(!await storage.getVisita(visit.id,empresaId,context.userId,context.userRole))return res.status(404).json({message:'File not found'});
      }
    }catch{return res.status(404).json({message:'File not found'});}
  }

  const candidates = [
    path.join(uploadsDir, safeFilename),
    path.join(legacyUploadsDir, safeFilename),
  ];
  const filePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    return res.status(404).json({ message: "File not found" });
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader(
    "Content-Security-Policy",
    "sandbox; default-src 'none'; style-src 'unsafe-inline'",
  );
  return res.sendFile(filePath);
});

export default router;

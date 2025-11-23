import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { getUserContext, ensureAuthenticated, requireAdmin } from "./authContext";
import { transcribeAudio, generateVisitSummary, extractBusinessCardData, generateEmailDraft } from "./openai";
import { sendVisitEmail } from "./email";
import { enrichEntity, type EnrichmentInput, extractDomainFromEmail, isPersonalEmailDomain } from "./enrichment";
import { ptIntelligentSearch, type PTEnrichmentInput } from "./enrichmentPT";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { insertEntidadeSchema, insertContactoSchema, insertVisitaSchema, insertTarefaSchema, lembretes } from "@shared/schema";
import { generateEmailRequestSchema, getTemplate } from "@shared/emailTemplates";
import { eq, and, desc, sql } from "drizzle-orm";
import express from "express";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { pt } from "date-fns/locale";

// Ensure upload directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer with custom storage
const storage_config = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept audio, images, and videos
    const allowedMimes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|ogg|m4a|webm/;
    const extname = allowedMimes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only images, videos, and audio files are allowed.'));
  },
});

/**
 * Detect image MIME type from binary header (magic bytes)
 */
function getImageMimeType(buffer: Buffer): string | null {
  // Check magic bytes for common image formats
  if (buffer.length < 4) return null;
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  
  // HEIC/HEIF: check for ftyp box at bytes 4-7 and major_brand at bytes 8-11
  if (buffer.length >= 12) {
    const ftypBox = buffer.toString('ascii', 4, 8);
    if (ftypBox === 'ftyp') {
      // Read ftyp box size from bytes 0-3 (big-endian)
      const ftypSize = buffer.readUInt32BE(0);
      
      // Validate ftyp size is reasonable and within buffer bounds
      if (ftypSize < 12 || ftypSize > buffer.length) {
        // Invalid or truncated ftyp box, cannot reliably detect
        return null;
      }
      
      // The major_brand is a 4-byte value at bytes 8-11 (case-insensitive)
      const majorBrand = buffer.toString('ascii', 8, 12).toLowerCase();
      
      // Direct HEIC brands (specific variants)
      const directHeicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'];
      if (directHeicBrands.includes(majorBrand)) {
        return 'image/heic';
      }
      
      // Generic container brands (mif1, msf1) - check ALL compatible brands within ftyp box
      const genericBrands = ['mif1', 'msf1'];
      if (genericBrands.includes(majorBrand)) {
        // Compatible brands start at byte 16 and continue until ftyp box ends
        // Safely iterate only within the validated ftyp box bounds
        for (let i = 16; i + 4 <= ftypSize && i + 4 <= buffer.length; i += 4) {
          const compatibleBrand = buffer.toString('ascii', i, i + 4).toLowerCase();
          if (directHeicBrands.includes(compatibleBrand)) {
            return 'image/heic';
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Universal entity + contact auto-creation helper with RBAC enforcement
 * 
 * RBAC MODEL:
 * - Both agents and admins can CREATE entities and contacts
 * - Agents can only READ entities/contacts they created or are assigned to
 * - Admins can READ all entities/contacts
 * - When auto-creating from scanned business cards:
 *   - Created entity is assigned to the scanning user (createdByUserId = assignedUserId)
 *   - This is intentional: the user who discovers the entity becomes its owner
 *   - No privilege escalation: agents can always create entities for themselves
 * 
 * VALIDATION:
 * - Uses Zod schema validation (insertEntidadeSchema, insertContactoSchema)
 * - Ensures data integrity and prevents invalid field values
 * - Same validation as normal REST endpoints
 */
async function createContactWithUniversalLogic(data: {
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  address?: string;
  website?: string;
  domain?: string;
  userId: string;
  userRole: 'admin' | 'agent';
}): Promise<{
  contacto: any;
  entidade: { id: string; nome: string; status: 'existing' | 'created' | 'none' } | null;
  message: string;
}> {
  let entidadeId: string | undefined;
  let entidadeStatus: 'existing' | 'created' | 'none' = 'none';
  let entidadeNome: string | undefined;

  // UNIVERSAL ENTITY AUTO-CREATION LOGIC WITH RBAC
  // Step 1: Try to find existing entity by organization name
  if (data.organization) {
    const existingByName = await storage.findEntidadeByNome(data.organization, data.userId, data.userRole);
    if (existingByName) {
      entidadeId = existingByName.id;
      entidadeNome = existingByName.nome;
      entidadeStatus = 'existing';
    }
  }

  // Step 2: If not found and we have domain, try to find by domain
  if (!entidadeId && data.domain) {
    const existingByDomain = await storage.findEntidadeByDomain(data.domain, data.userId, data.userRole);
    if (existingByDomain) {
      entidadeId = existingByDomain.id;
      entidadeNome = existingByDomain.nome;
      entidadeStatus = 'existing';
    }
  }

  // Step 3: If still not found but we have clues, create new entity
  if (!entidadeId && (data.organization || data.domain)) {
    const entityName = data.organization || data.domain || 'Entidade Desconhecida';
    
    // Validate and create entity using schema validation
    // Default to 'Gabinete' for auto-created entities (user can change type later)
    const validatedEntityData = insertEntidadeSchema.parse({
      nome: entityName,
      tipoEntidade: 'Gabinete',
      domain: data.domain || undefined,
      website: data.website || undefined,
      morada: data.address || undefined,
      createdByUserId: data.userId,
      // assignedUserId can be set later through normal assignment flow
      // For auto-created entities, we assign to the creator for convenience
      assignedUserId: data.userId,
    });
    
    const newEntidade = await storage.createEntidade(validatedEntityData);
    entidadeId = newEntidade.id;
    entidadeNome = newEntidade.nome;
    entidadeStatus = 'created';
    
    // Step 3.5: Auto-enrich newly created entity
    try {
      console.log(`[Auto-Enrichment] Enriching new entity: ${entityName}`);
      
      const enrichmentInput: EnrichmentInput = {
        name: entityName,
        domain: data.domain,
        website: data.website,
      };
      
      const enrichmentResult = await enrichEntity(enrichmentInput);
      
      // Only update if we got meaningful enrichment data
      if (enrichmentResult.enrichmentSource !== 'none') {
        const enrichedData: any = {
          description: enrichmentResult.description,
          industry: enrichmentResult.industry,
          logoUrl: enrichmentResult.logoUrl,
          linkedinUrl: enrichmentResult.linkedinUrl,
          facebookUrl: enrichmentResult.facebookUrl,
          instagramUrl: enrichmentResult.instagramUrl,
          xUrl: enrichmentResult.xUrl,
          lastEnrichedAt: new Date(),
          enrichmentSource: enrichmentResult.enrichmentSource,
        };
        
        // Update domain/website if enrichment found better values
        if (enrichmentResult.domain && !newEntidade.domain) {
          enrichedData.domain = enrichmentResult.domain;
        }
        if (enrichmentResult.website && !newEntidade.website) {
          enrichedData.website = enrichmentResult.website;
        }
        if (enrichmentResult.telefone && !newEntidade.telefone) {
          enrichedData.telefone = enrichmentResult.telefone;
        }
        if (enrichmentResult.morada && !newEntidade.morada) {
          enrichedData.morada = enrichmentResult.morada;
        }
        
        // Update entity with enriched data
        await storage.updateEntidade(entidadeId, enrichedData);
        console.log(`[Auto-Enrichment] Successfully enriched entity ${entidadeId} (source: ${enrichmentResult.enrichmentSource})`);
      } else {
        console.log(`[Auto-Enrichment] No enrichment data found for ${entityName}`);
      }
    } catch (enrichmentError) {
      // Don't fail entity creation if enrichment fails
      console.error('[Auto-Enrichment] Failed to enrich entity:', enrichmentError);
      console.log('[Auto-Enrichment] Entity created without enrichment');
    }
  }

  // Step 4: Always create contacto with validation
  const validatedContactData = insertContactoSchema.parse({
    nome: data.name,
    email: data.email || undefined,
    telemovel: data.phone || undefined,
    funcao: data.jobTitle || undefined,
    entidadeId: entidadeId,
    createdByUserId: data.userId,
  });
  
  const contacto = await storage.createContacto(validatedContactData);

  return {
    contacto,
    entidade: entidadeId ? {
      id: entidadeId,
      nome: entidadeNome!,
      status: entidadeStatus,
    } : null,
    message: entidadeStatus === 'created' 
      ? `Contacto e entidade "${entidadeNome}" criados automaticamente`
      : entidadeStatus === 'existing'
      ? `Contacto criado e associado à entidade "${entidadeNome}"`
      : "Contacto criado sem entidade associada",
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve service worker with correct MIME type
  app.get('/sw.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
  });

  // Serve uploaded files statically
  app.use('/uploads', express.static(uploadsDir));
  
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // FASE 4: Include empresa data in auth response
      let empresa = null;
      if (user?.empresaId) {
        empresa = await storage.getEmpresa(user.empresaId);
      }
      
      res.json({
        ...user,
        empresa: empresa ? {
          id: empresa.id,
          nome: empresa.nome,
          logoUrl: empresa.logoUrl,
          mostrarMarcasEmVisitas: empresa.mostrarMarcasEmVisitas,
          theme: empresa.theme,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get all users (for admin dropdown)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const { userRole } = await getUserContext(req);
      
      // Only admins can list all users
      if (userRole !== 'admin') {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Dashboard endpoint - FASE 2: filtered by empresaId
  app.get('/api/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const stats = await storage.getDashboardStats(empresaId, userId, userRole);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Analytics endpoint - FASE 2: filtered by empresaId
  app.get('/api/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      // Parse query params for filters
      const filters: {
        period?: number;
        agente?: string;
        tipoEntidade?: string;
      } = {};

      if (req.query.period) {
        filters.period = parseInt(req.query.period as string);
      }

      if (req.query.agente && userRole === 'admin') {
        filters.agente = req.query.agente as string;
      }

      if (req.query.tipoEntidade) {
        filters.tipoEntidade = req.query.tipoEntidade as string;
      }

      const analytics = await storage.getAnalytics(empresaId, userId, userRole, filters);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin test endpoint - FASE 2: Test middleware requireAdmin
  app.get('/api/admin/ping', requireAdmin, async (req: any, res) => {
    res.json({ 
      message: 'Admin access confirmed',
      userRole: req.userContext?.userRole,
      empresaId: req.userContext?.empresaId
    });
  });

  // Entidades endpoints (Universal Entities) - FASE 2: filtered by empresaId
  app.get('/api/entidades', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const entidades = await storage.getEntidades(empresaId, userId, userRole);
      res.json(entidades);
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ message: "Failed to fetch entidades" });
    }
  });

  app.get('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const entidade = await storage.getEntidade(req.params.id, empresaId, userId, userRole);
      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found" });
      }
      res.json(entidade);
    } catch (error) {
      console.error("Error fetching entidade:", error);
      res.status(500).json({ message: "Failed to fetch entidade" });
    }
  });

  app.post('/api/entidades', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const validatedData = insertEntidadeSchema.parse(req.body);
      // Set createdByUserId to current user - FASE 2: empresaId set by createEntidade
      const entidade = await storage.createEntidade({
        ...validatedData,
        createdByUserId: userId,
      }, empresaId);
      
      // Auto-enrich newly created entity (non-blocking)
      (async () => {
        try {
          console.log(`[Auto-Enrichment] Enriching manually created entity: ${entidade.nome}`);
          
          const enrichmentInput: EnrichmentInput = {
            name: entidade.nome,
            domain: entidade.domain || undefined,
            website: entidade.website || undefined,
          };
          
          const enrichmentResult = await enrichEntity(enrichmentInput);
          
          if (enrichmentResult.enrichmentSource !== 'none') {
            const enrichedData: any = {
              description: enrichmentResult.description,
              industry: enrichmentResult.industry,
              logoUrl: enrichmentResult.logoUrl,
              linkedinUrl: enrichmentResult.linkedinUrl,
              facebookUrl: enrichmentResult.facebookUrl,
              instagramUrl: enrichmentResult.instagramUrl,
              xUrl: enrichmentResult.xUrl,
              lastEnrichedAt: new Date(),
              enrichmentSource: enrichmentResult.enrichmentSource,
            };
            
            if (enrichmentResult.domain && !entidade.domain) enrichedData.domain = enrichmentResult.domain;
            if (enrichmentResult.website && !entidade.website) enrichedData.website = enrichmentResult.website;
            if (enrichmentResult.telefone && !entidade.telefone) enrichedData.telefone = enrichmentResult.telefone;
            if (enrichmentResult.morada && !entidade.morada) enrichedData.morada = enrichmentResult.morada;
            
            await storage.updateEntidade(entidade.id, enrichedData, empresaId);
            console.log(`[Auto-Enrichment] Successfully enriched entity ${entidade.id} (source: ${enrichmentResult.enrichmentSource})`);
          }
        } catch (enrichmentError) {
          console.error('[Auto-Enrichment] Failed to enrich manually created entity:', enrichmentError);
        }
      })();
      
      res.json(entidade);
    } catch (error) {
      console.error("Error creating entidade:", error);
      res.status(400).json({ message: "Failed to create entidade" });
    }
  });

  app.patch('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const validatedData = insertEntidadeSchema.partial().parse(req.body);
      const entidade = await storage.updateEntidade(req.params.id, validatedData, empresaId, userId, userRole);
      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found or unauthorized" });
      }
      res.json(entidade);
    } catch (error) {
      console.error("Error updating entidade:", error);
      res.status(400).json({ message: "Failed to update entidade" });
    }
  });

  app.delete('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      // Check if entidade has related contacts or visits
      const hasRelations = await storage.checkEntidadeHasRelations(req.params.id);
      if (hasRelations) {
        return res.status(400).json({ 
          message: "Não é possível eliminar. Esta entidade tem contactos ou visitas associadas." 
        });
      }
      
      await storage.deleteEntidade(req.params.id, empresaId, userId, userRole);
      res.json({ message: "Entidade deleted" });
    } catch (error) {
      console.error("Error deleting entidade:", error);
      res.status(500).json({ message: "Failed to delete entidade" });
    }
  });

  // Contactos endpoints - FASE 2: filtered by empresaId
  app.get('/api/contactos', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const contactos = await storage.getContactos(empresaId, userId, userRole);
      res.json(contactos);
    } catch (error) {
      console.error("Error fetching contactos:", error);
      res.status(500).json({ message: "Failed to fetch contactos" });
    }
  });

  app.get('/api/contactos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const contacto = await storage.getContacto(req.params.id, empresaId, userId, userRole);
      if (!contacto) {
        return res.status(404).json({ message: "Contacto not found" });
      }
      res.json(contacto);
    } catch (error) {
      console.error("Error fetching contacto:", error);
      res.status(500).json({ message: "Failed to fetch contacto" });
    }
  });

  app.post('/api/contactos', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const validatedData = insertContactoSchema.parse(req.body);
      // Set createdByUserId to current user - FASE 2: empresaId set by createContacto
      const contacto = await storage.createContacto({
        ...validatedData,
        createdByUserId: userId,
      }, empresaId);
      res.json(contacto);
    } catch (error) {
      console.error("Error creating contacto:", error);
      res.status(400).json({ message: "Failed to create contacto" });
    }
  });

  app.patch('/api/contactos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const validatedData = insertContactoSchema.partial().parse(req.body);
      const contacto = await storage.updateContacto(req.params.id, validatedData, empresaId, userId, userRole);
      if (!contacto) {
        return res.status(404).json({ message: "Contacto not found or unauthorized" });
      }
      res.json(contacto);
    } catch (error) {
      console.error("Error updating contacto:", error);
      res.status(400).json({ message: "Failed to update contacto" });
    }
  });

  app.delete('/api/contactos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      await storage.deleteContacto(req.params.id, empresaId, userId, userRole);
      res.json({ message: "Contacto deleted" });
    } catch (error) {
      console.error("Error deleting contacto:", error);
      res.status(500).json({ message: "Failed to delete contacto" });
    }
  });

  // Business Card Vision endpoint - FASE 2: filtered by empresaId
  app.post('/api/tools/vision-card', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const { base64Image } = req.body;

      if (!base64Image) {
        return res.status(400).json({ message: "Image data is required" });
      }

      // Extract pure base64 if data URL is provided (case-insensitive)
      let pureBase64 = base64Image;
      if (base64Image.startsWith('data:')) {
        const matches = base64Image.match(/^data:image\/(jpeg|jpg|png|webp|heic);base64,(.+)$/i);
        if (!matches) {
          return res.status(400).json({ message: "Invalid image data URL. Only JPEG, PNG, WebP, and HEIC images are supported" });
        }
        pureBase64 = matches[2];
      }

      // Validate base64 format (allows padding and whitespace)
      const cleanBase64 = pureBase64.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]+=*$/.test(cleanBase64)) {
        return res.status(400).json({ message: "Invalid base64 image data format" });
      }

      // Decode and validate actual binary data
      let imageBuffer: Buffer;
      try {
        imageBuffer = Buffer.from(cleanBase64, 'base64');
      } catch (error) {
        return res.status(400).json({ message: "Failed to decode base64 image data" });
      }

      // Validate decoded size (5MB limit for safety)
      if (imageBuffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ message: "Image too large. Maximum decoded size is 5MB" });
      }

      // Verify actual MIME type from binary headers
      const mimeType = getImageMimeType(imageBuffer);
      console.log(`[Vision Card] Detected MIME type: ${mimeType}, Size: ${imageBuffer.length} bytes`);
      
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
      if (!mimeType || !allowedTypes.includes(mimeType)) {
        console.warn(`[Vision Card] Rejected image with MIME: ${mimeType}`);
        return res.status(400).json({ message: "Invalid or unsupported image format. Only JPEG, PNG, WebP, and HEIC are allowed" });
      }

      // Build proper data URL with detected MIME type for OpenAI
      const dataUrl = `data:${mimeType};base64,${cleanBase64}`;
      
      // Extract data using OpenAI Vision
      const extracted = await extractBusinessCardData(dataUrl);

      // Determine name from fullName or firstName/lastName
      const name = extracted.fullName || 
                   (extracted.firstName && extracted.lastName ? `${extracted.firstName} ${extracted.lastName}` : "") ||
                   extracted.firstName || 
                   extracted.lastName || "";

      if (!name) {
        return res.status(400).json({ message: "Could not extract contact name from business card" });
      }

      // Extract domain from email or website (same logic as vCard)
      let domain: string | undefined;
      if (extracted.email && extracted.email.includes('@')) {
        const emailDomain = extracted.email.split('@')[1].toLowerCase();
        const genericProviders = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'aol.com', 'protonmail.com'];
        if (!genericProviders.includes(emailDomain)) {
          domain = emailDomain;
        }
      }

      if (!domain && extracted.website) {
        try {
          const url = extracted.website.startsWith('http') ? extracted.website : `https://${extracted.website}`;
          const urlObj = new URL(url);
          domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
        } catch (e) {
          // Invalid URL, ignore
        }
      }

      // Use universal auto-creation logic with RBAC - FASE 2: pass empresaId
      const result = await createContactWithUniversalLogic({
        name,
        organization: extracted.organization,
        email: extracted.email,
        phone: extracted.phone,
        jobTitle: extracted.jobTitle,
        address: extracted.address,
        website: extracted.website,
        domain,
        userId,
        userRole,
        empresaId,
      });

      // Return comprehensive response including extracted data
      res.json({
        ...result,
        extracted: {
          fullName: name,
          jobTitle: extracted.jobTitle,
          organization: extracted.organization,
          email: extracted.email,
          phone: extracted.phone,
          website: extracted.website,
          address: extracted.address,
          socialLinks: {
            linkedin: extracted.linkedin,
            instagram: extracted.instagram,
            facebook: extracted.facebook,
            twitter: extracted.twitter,
          }
        },
      });
    } catch (error) {
      console.error("Error processing business card:", error);
      res.status(500).json({ message: "Failed to process business card image" });
    }
  });

  // Email generation endpoint with AI - FASE 2: filtered by empresaId
  app.post('/api/tools/generate-email', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      // Validate request
      const validationResult = generateEmailRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request", 
          errors: validationResult.error.issues 
        });
      }

      const { templateType, tone, visitaId, contactoId, entidadeId } = validationResult.data;

      // Get template for fallback
      const template = getTemplate(templateType);

      // Fetch data based on provided IDs (respecting RBAC)
      let visita: any = null;
      let contacto: any = null;
      let entidade: any = null;
      let user: any = null;
      let recentVisits: any[] = [];

      if (visitaId) {
        visita = await storage.getVisita(visitaId, empresaId, userId, userRole);
        if (!visita) {
          return res.status(404).json({ message: "Visit not found or unauthorized" });
        }

        // Get related data from visit - FASE 2: pass empresaId
        if (visita.contactoId) {
          contacto = await storage.getContacto(visita.contactoId, empresaId, userId, userRole);
        }
        if (visita.entidadeId) {
          entidade = await storage.getEntidade(visita.entidadeId, empresaId, userId, userRole);
        }

        // Get recent visits for context (last 3) - FASE 2: pass empresaId
        if (visita.entidadeId) {
          const allVisits = await storage.getVisitas(empresaId, userId, userRole);
          recentVisits = allVisits
            .filter((v: any) => v.entidadeId === visita.entidadeId && v.id !== visitaId)
            .sort((a: any, b: any) => new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime())
            .slice(0, 3);
        }
      } else if (contactoId) {
        contacto = await storage.getContacto(contactoId, empresaId, userId, userRole);
        if (!contacto) {
          return res.status(404).json({ message: "Contact not found or unauthorized" });
        }
        if (contacto.entidadeId) {
          entidade = await storage.getEntidade(contacto.entidadeId, empresaId, userId, userRole);
        }
      } else if (entidadeId) {
        entidade = await storage.getEntidade(entidadeId, empresaId, userId, userRole);
        if (!entidade) {
          return res.status(404).json({ message: "Entity not found or unauthorized" });
        }
      }

      // Get user info for signature
      user = await storage.getUser(userId);

      // Prepare visit data if available - FASE 2: pass empresaId
      let visitData;
      if (visita) {
        // Get tasks related to visit
        const allTasks = await storage.getTarefas(empresaId, userId, userRole);
        const visitTasks = allTasks.filter(t => t.visitaId === visitaId);

        visitData = {
          dataVisita: new Date(visita.dataVisita),
          notas: visita.notas || undefined,
          marcasEntregues: visita.marcasEntregues || undefined,
          resumoIa: visita.resumoIa || undefined,
          tarefas: visitTasks.map(t => ({
            titulo: t.titulo,
            descricao: t.descricao || undefined,
          })),
        };
      }

      // Generate email using AI
      const result = await generateEmailDraft({
        templateType: template.label,
        tone,
        entidadeName: entidade?.nome,
        contactoName: contacto?.nome,
        contactoEmail: contacto?.email || undefined,
        visitData,
        recentVisits: recentVisits.map((v: any) => ({
          dataVisita: new Date(v.dataVisita),
          notas: v.notas ?? undefined,
        })),
        userName: user?.firstName && user?.lastName
          ? `${user.firstName} ${user.lastName}`
          : user?.email,
      });

      res.json(result);
    } catch (error) {
      console.error("Error generating email:", error);
      res.status(500).json({ message: "Failed to generate email" });
    }
  });

  // vCard import endpoint with universal entity auto-creation - FASE 2: filtered by empresaId
  app.post('/api/tools/vcard-import', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const { name, organization, email, phone, title, address, url, domain } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Contact name is required" });
      }

      // Use universal auto-creation logic with RBAC - FASE 2: pass empresaId
      const result = await createContactWithUniversalLogic({
        name,
        organization,
        email,
        phone,
        jobTitle: title,
        address,
        website: url,
        domain,
        userId,
        userRole,
        empresaId,
      });

      res.json(result);
    } catch (error) {
      console.error("Error importing vCard:", error);
      res.status(500).json({ message: "Failed to import vCard" });
    }
  });

  // @deprecated Legacy enrichment endpoint (use PT-Intelligent Search instead)
  // Kept for backwards compatibility only - FASE 2: filtered by empresaId
  app.post('/api/enrichment/full', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const { entityId, name, domain, website, visionText } = req.body;

      // If enriching existing entity, check RBAC access - FASE 2: pass empresaId
      if (entityId) {
        const existingEntity = await storage.getEntidade(entityId, empresaId, userId, userRole);
        if (!existingEntity) {
          return res.status(404).json({ message: "Entity not found or unauthorized" });
        }

        // Build enrichment input
        const enrichmentInput: EnrichmentInput = {
          name: existingEntity.nome,
          domain: domain || existingEntity.domain || undefined,
          website: website || existingEntity.website || undefined,
          visionText: visionText || undefined,
        };

        // Skip if domain is personal email
        if (enrichmentInput.domain && isPersonalEmailDomain(enrichmentInput.domain)) {
          return res.json({
            skipped: true,
            reason: 'personal_email',
            message: 'Enrichment skipped for personal email domains',
          });
        }

        // Call enrichment service
        const enrichmentResult = await enrichEntity(enrichmentInput);

        if (enrichmentResult.enrichmentSource === 'none') {
          return res.json({
            skipped: true,
            reason: 'no_data',
            message: 'No enrichment data available',
          });
        }

        // Prepare update data - only update empty fields
        const updateData: any = {
          lastEnrichedAt: new Date(),
          enrichmentSource: enrichmentResult.enrichmentSource,
        };

        // Only update fields that are currently empty or null
        if (!existingEntity.domain && enrichmentResult.domain) {
          updateData.domain = enrichmentResult.domain;
        }
        if (!existingEntity.website && enrichmentResult.website) {
          updateData.website = enrichmentResult.website;
        }
        if (!existingEntity.logoUrl && enrichmentResult.logoUrl) {
          updateData.logoUrl = enrichmentResult.logoUrl;
        }
        if (!existingEntity.descricao && enrichmentResult.description) {
          updateData.descricao = enrichmentResult.description;
        }
        if (!existingEntity.industry && enrichmentResult.industry) {
          updateData.industry = enrichmentResult.industry;
        }
        if (!existingEntity.linkedinUrl && enrichmentResult.linkedinUrl) {
          updateData.linkedinUrl = enrichmentResult.linkedinUrl;
        }
        if (!existingEntity.facebookUrl && enrichmentResult.facebookUrl) {
          updateData.facebookUrl = enrichmentResult.facebookUrl;
        }
        if (!existingEntity.instagramUrl && enrichmentResult.instagramUrl) {
          updateData.instagramUrl = enrichmentResult.instagramUrl;
        }
        if (!existingEntity.xUrl && enrichmentResult.xUrl) {
          updateData.xUrl = enrichmentResult.xUrl;
        }
        if (!existingEntity.telefone && enrichmentResult.telefone) {
          updateData.telefone = enrichmentResult.telefone;
        }
        if (!existingEntity.morada && enrichmentResult.morada) {
          updateData.morada = enrichmentResult.morada;
        }

        // Update entity - FASE 2: pass empresaId
        const updatedEntity = await storage.updateEntidade(entityId, updateData, empresaId, userId, userRole);

        // Return what was updated
        const updatedFields = Object.keys(updateData).filter(k => k !== 'lastEnrichedAt' && k !== 'enrichmentSource');

        return res.json({
          success: true,
          entity: updatedEntity,
          updatedFields,
          enrichmentSource: enrichmentResult.enrichmentSource,
        });
      }

      // If no entityId, just return enrichment data (for preview)
      if (!name) {
        return res.status(400).json({ message: "Name is required for enrichment" });
      }

      const enrichmentInput: EnrichmentInput = {
        name,
        domain: domain || undefined,
        website: website || undefined,
        visionText: visionText || undefined,
      };

      // Skip if domain is personal email
      if (enrichmentInput.domain && isPersonalEmailDomain(enrichmentInput.domain)) {
        return res.json({
          skipped: true,
          reason: 'personal_email',
          message: 'Enrichment skipped for personal email domains',
        });
      }

      const enrichmentResult = await enrichEntity(enrichmentInput);

      return res.json({
        success: true,
        data: enrichmentResult,
      });
    } catch (error) {
      console.error("Error enriching entity:", error);
      res.status(500).json({ message: "Failed to enrich entity" });
    }
  });

  // Lembretes (Reminders) endpoints - FASE 2: filtered by empresaId
  app.get('/api/lembretes', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const { generateAllReminders } = await import('./reminders');
      const user = await storage.getUser(userId);
      if (user) {
        await generateAllReminders(user);
      }
      
      let query = db
        .select()
        .from(lembretes)
        .where(
          and(
            eq(lembretes.userId, userId),
            eq(lembretes.resolved, false),
            sql`(${lembretes.snoozedUntil} IS NULL OR ${lembretes.snoozedUntil} <= NOW())`
          )
        )
        .orderBy(desc(lembretes.dataCriacao))
        .$dynamic();

      const results = await query;
      res.json(results);
    } catch (error) {
      console.error("Error fetching lembretes:", error);
      res.status(500).json({ message: "Failed to fetch reminders" });
    }
  });

  app.post('/api/lembretes/snooze', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const { reminderId, duration } = req.body;

      if (!reminderId || !duration) {
        return res.status(400).json({ message: "Reminder ID and duration required" });
      }

      if (!['2days', '7days', '30days'].includes(duration)) {
        return res.status(400).json({ message: "Invalid duration" });
      }

      const reminder = await db
        .select()
        .from(lembretes)
        .where(
          and(
            eq(lembretes.id, reminderId),
            eq(lembretes.userId, userId)
          )
        )
        .limit(1);

      if (reminder.length === 0) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      const { snoozeReminder } = await import('./reminders');
      await snoozeReminder(reminderId, duration);

      res.json({ message: "Reminder snoozed successfully" });
    } catch (error) {
      console.error("Error snoozing reminder:", error);
      res.status(500).json({ message: "Failed to snooze reminder" });
    }
  });

  app.post('/api/lembretes/resolve', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const { reminderId } = req.body;

      if (!reminderId) {
        return res.status(400).json({ message: "Reminder ID required" });
      }

      const reminder = await db
        .select()
        .from(lembretes)
        .where(
          and(
            eq(lembretes.id, reminderId),
            eq(lembretes.userId, userId)
          )
        )
        .limit(1);

      if (reminder.length === 0) {
        return res.status(404).json({ message: "Reminder not found" });
      }

      const { resolveReminder } = await import('./reminders');
      await resolveReminder(reminderId);

      res.json({ message: "Reminder resolved successfully" });
    } catch (error) {
      console.error("Error resolving reminder:", error);
      res.status(500).json({ message: "Failed to resolve reminder" });
    }
  });

  app.post('/api/lembretes/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { generateAllReminders } = await import('./reminders');
      const count = await generateAllReminders(user);

      res.json({ 
        message: "Reminders generated successfully",
        count 
      });
    } catch (error) {
      console.error("Error generating reminders:", error);
      res.status(500).json({ message: "Failed to generate reminders" });
    }
  });

  // Visitas endpoints - FASE 2: filtered by empresaId, FASE 11: query params support
  app.get('/api/visitas', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      let visitas = await storage.getVisitas(empresaId, userId, userRole);
      
      // Apply query filters (FASE 11)
      const search = req.query.search as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const filterUserId = req.query.userId as string | undefined;
      const marcaId = req.query.marcaId as string | undefined;
      const hasAudioToTranscribe = req.query.hasAudioToTranscribe === 'true';
      
      visitas = visitas.filter(v => {
        // Search filter
        if (search) {
          const q = search.toLowerCase();
          const matchesSearch = 
            v.entidade?.nome.toLowerCase().includes(q) ||
            v.contacto?.nome.toLowerCase().includes(q) ||
            v.notas?.toLowerCase().includes(q);
          if (!matchesSearch) return false;
        }
        
        // Date range filter
        if (from || to) {
          const visitaDate = new Date(v.dataVisita);
          if (from) {
            const fromDate = new Date(from);
            if (visitaDate < fromDate) return false;
          }
          if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            if (visitaDate > toDate) return false;
          }
        }
        
        // User filter (admin only)
        if (filterUserId && v.createdByUserId !== filterUserId) return false;
        
        // Marca filter
        if (marcaId && !v.marcas?.some(m => m.marcaId === marcaId)) return false;
        
        // Audio to transcribe filter
        if (hasAudioToTranscribe) {
          const hasAudio = v.audioUrl || (v.audios && v.audios.length > 0);
          const hasUntranscribedAudio = v.audios?.some(a => !a.transcricao);
          if (!hasAudio || !hasUntranscribedAudio) return false;
        }
        
        return true;
      });
      
      res.json(visitas);
    } catch (error) {
      console.error("Error fetching visitas:", error);
      res.status(500).json({ message: "Failed to fetch visitas" });
    }
  });

  app.get('/api/visitas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }
      res.json(visita);
    } catch (error) {
      console.error("Error fetching visita:", error);
      res.status(500).json({ message: "Failed to fetch visita" });
    }
  });

  app.get('/api/visitas/:id/pdf', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      
      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }

      // Fetch related tarefas - FASE 2: filtered by empresaId
      const allTarefas = await storage.getTarefas(empresaId, userId, userRole);
      const visitaTarefas = allTarefas.filter(t => t.visitaId === req.params.id);

      // Generate PDF using jsPDF
      const { generateVisitaPDF } = await import('./pdfGenerator.js');
      const pdfBuffer = await generateVisitaPDF(visita, visitaTarefas);

      // Set headers for PDF download
      const entidadeNome = visita.entidade?.nome || 'visita';
      const dataVisita = new Date(visita.dataVisita).toISOString().split('T')[0];
      const fileName = `Visita-${entidadeNome.replace(/\s/g, '-')}-${dataVisita}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(Buffer.from(pdfBuffer));
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.get('/api/visitas/:id/ics', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      
      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }

      // Generate ICS file
      const { generateVisitaICS, generateVisitaICSFilename } = await import('./icsExport.js');
      const icsContent = generateVisitaICS(visita);
      const fileName = generateVisitaICSFilename(visita);

      // Set headers for ICS download
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating ICS:", error);
      res.status(500).json({ message: "Failed to generate calendar file" });
    }
  });

  // FASE 6: Audio endpoints
  app.post('/api/visitas/:id/audio', isAuthenticated, upload.single('audio'), async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      if (!visita) return res.status(404).json({ message: "Visita not found" });
      
      if (!req.file) return res.status(400).json({ message: "No audio file provided" });
      
      const fileUrl = `/uploads/${req.file.filename}`;
      const audioRecord = await storage.addAudioToVisita(req.params.id, fileUrl, empresaId);
      res.json(audioRecord);
    } catch (error) {
      console.error("Error uploading audio:", error);
      res.status(400).json({ message: "Failed to upload audio" });
    }
  });

  app.get('/api/visitas/:id/audio', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      if (!visita) return res.status(404).json({ message: "Visita not found" });
      
      const audioClips = await storage.getVisitasAudio(req.params.id, empresaId);
      res.json(audioClips);
    } catch (error) {
      console.error("Error fetching audio:", error);
      res.status(500).json({ message: "Failed to fetch audio" });
    }
  });

  app.delete('/api/visitas/:id/audio/:audioId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      if (!visita) return res.status(404).json({ message: "Visita not found" });
      
      await storage.deleteVisitasAudio(req.params.audioId, empresaId);
      res.json({ message: "Audio deleted" });
    } catch (error) {
      console.error("Error deleting audio:", error);
      res.status(400).json({ message: "Failed to delete audio" });
    }
  });

  app.post('/api/visitas/:id/audio/:audioId/transcrever', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const visita = await storage.getVisita(req.params.id, empresaId, userId, userRole);
      if (!visita) return res.status(404).json({ message: "Visita not found" });
      
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) return res.status(500).json({ message: "OpenAI not configured" });
      
      const { OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: openaiApiKey });
      
      const audioRecord = await storage.getVisitasAudio(req.params.id, empresaId);
      const targetAudio = audioRecord.find(a => a.id === req.params.audioId);
      
      if (!targetAudio || !targetAudio.fileUrl) {
        return res.status(404).json({ message: "Audio not found" });
      }
      
      // Extract filename from URL path and read from disk
      const filename = targetAudio.fileUrl.split('/').pop();
      const filePath = path.join(uploadsDir, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Audio file not found on disk" });
      }
      
      // Create readable stream for OpenAI
      const audioStream = fs.createReadStream(filePath);
      
      const transcription = await client.audio.transcriptions.create({
        file: audioStream as any,
        model: "whisper-1",
        language: "pt",
      });
      
      const updated = await storage.updateVisitasAudioTranscription(req.params.audioId, transcription.text);
      res.json(updated);
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(400).json({ message: "Failed to transcribe audio" });
    }
  });

  app.post('/api/visitas', isAuthenticated, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'media', maxCount: 10 }
  ]), async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const files = req.files as { audio?: Express.Multer.File[], media?: Express.Multer.File[] };
      
      // Parse form data with safe JSON parsing
      let marcasEntregues: string[] = [];
      if (req.body.marcasEntregues) {
        try {
          const parsed = JSON.parse(req.body.marcasEntregues);
          marcasEntregues = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error("Invalid marcasEntregues JSON:", error);
          return res.status(400).json({ message: "Invalid marcasEntregues format" });
        }
      }

      // Parse and validate GPS coordinates
      let latitude: string | null = null;
      let longitude: string | null = null;
      let locationAccuracy: string | null = null;
      
      if (req.body.latitude && req.body.longitude) {
        const lat = parseFloat(req.body.latitude);
        const lng = parseFloat(req.body.longitude);
        const acc = req.body.locationAccuracy ? parseFloat(req.body.locationAccuracy) : null;
        
        if (!isNaN(lat) && !isNaN(lng)) {
          latitude = lat.toString();
          longitude = lng.toString();
          locationAccuracy = acc && !isNaN(acc) ? acc.toString() : null;
        }
      }

      const visitaData = {
        entidadeId: req.body.entidadeId || null,
        contactoId: req.body.contactoId || null,
        userId: userId, // Legacy field
        createdByUserId: userId,
        dataVisita: new Date(req.body.dataVisita),
        notas: req.body.notas || null,
        marcasEntregues,
        proximaVisita: req.body.proximaVisita ? new Date(req.body.proximaVisita) : null,
        latitude,
        longitude,
        locationAccuracy,
        audioUrl: null as string | null,
        mediaUrls: [] as string[],
        linkVisita: randomUUID().substring(0, 8),
        transcricaoAudio: null as string | null,
        resumoIa: null as string | null,
      };

      // Handle audio file
      if (files?.audio && files.audio[0]) {
        const audioFile = files.audio[0];
        visitaData.audioUrl = `/uploads/${audioFile.filename}`;
        
        // Transcribe audio asynchronously
        try {
          const transcription = await transcribeAudio(audioFile.path);
          visitaData.transcricaoAudio = transcription.text;
        } catch (error) {
          console.error("Error transcribing audio:", error);
        }
      }

      // Handle media files
      if (files?.media) {
        visitaData.mediaUrls = files.media.map(file => `/uploads/${file.filename}`);
      }

      // Create visita - FASE 2: auto-set empresaId
      const visita = await storage.createVisita(visitaData, empresaId);

      // FASE 5: Add marcas to visita if provided
      if (req.body.marcasIds) {
        try {
          let marcasIds: string[] = [];
          if (typeof req.body.marcasIds === 'string') {
            marcasIds = JSON.parse(req.body.marcasIds);
          } else if (Array.isArray(req.body.marcasIds)) {
            marcasIds = req.body.marcasIds;
          }
          if (Array.isArray(marcasIds) && marcasIds.length > 0) {
            await storage.addMarcasToVisita(visita.id, marcasIds, empresaId);
          }
        } catch (error) {
          console.error("Error adding marcas to visita:", error);
        }
      }

      // Generate AI summary asynchronously
      const visitaComplete = await storage.getVisita(visita.id, empresaId, userId, userRole);
      if (visitaComplete) {
        try {
          const summary = await generateVisitSummary({
            notas: visitaData.notas || undefined,
            transcricaoAudio: visitaData.transcricaoAudio || undefined,
            marcasEntregues: visitaData.marcasEntregues,
            entidadeNome: visitaComplete.entidade?.nome || '',
            contactoNome: visitaComplete.contacto?.nome,
          });
          
          await storage.updateVisita(visita.id, { resumoIa: summary });
          
          // Send email notification
          const user = await storage.getUser(userId);
          if (user?.email) {
            await sendVisitEmail({
              toEmail: user.email,
              entidadeNome: visitaComplete.entidade?.nome || '',
              contactoNome: visitaComplete.contacto?.nome,
              dataVisita: visitaData.dataVisita,
              notas: visitaData.notas || undefined,
              marcasEntregues: visitaData.marcasEntregues,
              resumoIa: summary,
              linkVisita: `${req.protocol}://${req.hostname}/visitas/${visita.id}`,
            });
          }
        } catch (error) {
          console.error("Error generating summary or sending email:", error);
        }
      }

      res.json(visita);
    } catch (error) {
      console.error("Error creating visita:", error);
      res.status(400).json({ message: "Failed to create visita" });
    }
  });

  app.delete('/api/visitas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      await storage.deleteVisita(req.params.id, empresaId, userId, userRole);
      res.json({ message: "Visita deleted" });
    } catch (error) {
      console.error("Error deleting visita:", error);
      res.status(500).json({ message: "Failed to delete visita" });
    }
  });

  // Tarefas (Tasks) endpoints - FASE 2: filtered by empresaId
  app.get('/api/tarefas', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const filters = {
        status: req.query.status as string | undefined,
        assignedUserId: req.query.assignedUserId as string | undefined,
        entidadeId: req.query.entidadeId as string | undefined,
        overdue: req.query.overdue === 'true',
      };
      let tarefas = await storage.getTarefas(empresaId, userId, userRole, filters);
      
      // Apply search filter (FASE 11)
      const search = req.query.search as string | undefined;
      if (search) {
        const q = search.toLowerCase();
        tarefas = tarefas.filter(t =>
          t.titulo.toLowerCase().includes(q) ||
          t.descricao?.toLowerCase().includes(q) ||
          t.entidade?.nome.toLowerCase().includes(q)
        );
      }
      
      res.json(tarefas);
    } catch (error) {
      console.error("Error fetching tarefas:", error);
      res.status(500).json({ message: "Failed to fetch tarefas" });
    }
  });

  app.get('/api/tarefas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const tarefa = await storage.getTarefa(req.params.id, empresaId, userId, userRole);
      if (!tarefa) {
        return res.status(404).json({ message: "Tarefa not found" });
      }
      res.json(tarefa);
    } catch (error) {
      console.error("Error fetching tarefa:", error);
      res.status(500).json({ message: "Failed to fetch tarefa" });
    }
  });

  app.post('/api/tarefas', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const validatedData = insertTarefaSchema.parse(req.body);
      
      const cleanedData = {
        ...validatedData,
        entidadeId: validatedData.entidadeId || null,
        visitaId: validatedData.visitaId || null,
        assignedUserId: validatedData.assignedUserId || null,
        dueDate: validatedData.dueDate || null,
        createdByUserId: userId,
      };
      
      const tarefa = await storage.createTarefa(cleanedData, empresaId);
      res.json(tarefa);
    } catch (error) {
      console.error("Error creating tarefa:", error);
      res.status(400).json({ message: "Failed to create tarefa" });
    }
  });

  app.patch('/api/tarefas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const validatedData = insertTarefaSchema.partial().parse(req.body);
      
      const cleanedData = {
        ...validatedData,
        ...(validatedData.entidadeId !== undefined && { entidadeId: validatedData.entidadeId || null }),
        ...(validatedData.visitaId !== undefined && { visitaId: validatedData.visitaId || null }),
        ...(validatedData.assignedUserId !== undefined && { assignedUserId: validatedData.assignedUserId || null }),
        ...(validatedData.dueDate !== undefined && { dueDate: validatedData.dueDate || null }),
      };
      
      const tarefa = await storage.updateTarefa(req.params.id, cleanedData, empresaId, userId, userRole);
      if (!tarefa) {
        return res.status(404).json({ message: "Tarefa not found or unauthorized" });
      }
      res.json(tarefa);
    } catch (error) {
      console.error("Error updating tarefa:", error);
      res.status(400).json({ message: "Failed to update tarefa" });
    }
  });

  app.delete('/api/tarefas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole, empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      await storage.deleteTarefa(req.params.id, empresaId, userId, userRole);
      res.json({ message: "Tarefa deleted" });
    } catch (error) {
      console.error("Error deleting tarefa:", error);
      res.status(500).json({ message: "Failed to delete tarefa" });
    }
  });

  // Marcas endpoints (legacy - removed duplicate, using FASE 3+ endpoints below)

  // Odoo Integration Placeholder Endpoints
  // POST /api/sync/odoo - Manual sync trigger
  app.post('/api/sync/odoo', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      
      // TODO: Implement actual Odoo sync logic
      // - Query entities/contacts/visits with needsSync=true
      // - Push changes to Odoo API
      // - Update syncStatus and lastSyncAt
      // - Handle errors and update syncError
      
      console.log(`[Odoo Sync] Manual sync triggered by user ${userId} (role: ${userRole})`);
      
      res.json({ 
        success: true, 
        message: "Odoo sync placeholder - implementation pending",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in Odoo sync:", error);
      res.status(500).json({ message: "Odoo sync failed" });
    }
  });

  // POST /api/odoo/webhook - Odoo webhook receiver
  app.post('/api/odoo/webhook', async (req, res) => {
    try {
      // TODO: Implement Odoo webhook handler
      // - Verify webhook signature/auth
      // - Parse Odoo event payload
      // - Update local entities/contacts/visits
      // - Set needsSync=false for synchronized records
      // - Handle conflicts and errors
      
      console.log('[Odoo Webhook] Received webhook from Odoo:', req.body);
      
      res.json({ 
        success: true, 
        message: "Odoo webhook placeholder - implementation pending",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error processing Odoo webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // Entity Enrichment Endpoints
  // @deprecated Legacy autocomplete endpoint (use PT-Intelligent Search instead)
  app.post('/api/enrichment/autocomplete', isAuthenticated, async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Query parameter required' });
      }
      
      const { fetchClearbitAutocomplete } = await import('./enrichment');
      const results = await fetchClearbitAutocomplete(query);
      
      res.json(results);
    } catch (error) {
      console.error('[Enrichment] Autocomplete error:', error);
      res.status(500).json({ message: 'Autocomplete failed' });
    }
  });

  // POST /api/enrichment/enrich - Enrich entity data with AI
  app.post('/api/enrichment/enrich', isAuthenticated, async (req, res) => {
    try {
      const { name, domain } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: 'Name parameter required' });
      }
      
      const { enrichEntity } = await import('./enrichment');
      const enrichedData = await enrichEntity(name, domain);
      
      res.json(enrichedData);
    } catch (error) {
      console.error('[Enrichment] Enrich error:', error);
      res.status(500).json({ message: 'Enrichment failed' });
    }
  });

  // POST /api/enrichment/validate-nif - Validate Portuguese NIF
  app.post('/api/enrichment/validate-nif', isAuthenticated, async (req, res) => {
    try {
      const { nif } = req.body;
      
      if (!nif || typeof nif !== 'string') {
        return res.status(400).json({ message: 'NIF parameter required' });
      }
      
      const { validateNIF } = await import('./enrichment');
      const result = validateNIF(nif);
      
      res.json(result);
    } catch (error) {
      console.error('[Enrichment] NIF validation error:', error);
      res.status(500).json({ message: 'NIF validation failed' });
    }
  });

  // POST /api/enrichment/pt-intelligent-search - Portugal-optimized company search with fuzzy matching + Google Search
  app.post('/api/enrichment/pt-intelligent-search', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { nome, existingEntityId, tipoEntidade } = req.body;
      
      if (!nome || typeof nome !== 'string') {
        return res.status(400).json({ message: 'Nome parameter required' });
      }
      
      if (!tipoEntidade || typeof tipoEntidade !== 'string') {
        console.log('[PT-Search] Missing tipoEntidade - blocking search for safety');
        return res.json({
          fuzzyMatches: [],
          googleResults: [],
          enrichmentSource: 'disabled',
        });
      }
      
      const input: PTEnrichmentInput = {
        nome,
        userId,
        existingEntityId,
      };
      
      const result = await ptIntelligentSearch(input, storage, userRole);
      
      if (result.fuzzyMatches.length === 0) {
        console.log(`[PT-Search] No fuzzy matches for "${nome}", attempting Google Search (user: ${userId}, role: ${userRole}, type: ${tipoEntidade})`);
        const { searchCompanyData } = await import('./googleSearch');
        const googleResults = await searchCompanyData(nome);
        
        console.log(`[PT-Search] Google Search returned ${googleResults.length} results`);
        
        return res.json({
          ...result,
          googleResults,
          enrichmentSource: googleResults.length > 0 ? 'google' : result.enrichmentSource,
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error('[PT-Search] Intelligent search error:', error);
      res.status(500).json({ message: 'PT intelligent search failed' });
    }
  });

  // ============================================
  // MICROSOFT 365 INTEGRATION ROUTES (DISABLED)
  // ============================================
  // Disabled: Requires valid Azure App Registration with correct Client Secret value
  // Re-enable when proper credentials are configured
  
  /*
  
  // Microsoft OAuth Login
  app.get('/api/microsoft/auth/login', isAuthenticated, async (req, res) => {
    try {
      const { userId } = await getUserContext(req);
      
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const redirectUri = `${req.protocol}://${req.get('host')}/api/microsoft/auth/callback`;
      
      if (!clientId) {
        return res.status(500).json({ message: 'Microsoft OAuth not configured' });
      }
      
      const scopes = [
        'offline_access',
        'Tasks.ReadWrite',
        'User.Read'
      ];
      
      const state = randomUUID();
      req.session.msOAuthState = state;
      
      const authUrl = new URL('https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('response_mode', 'query');
      
      res.redirect(authUrl.toString());
    } catch (error) {
      console.error('[Microsoft Auth] Login error:', error);
      res.status(500).json({ message: 'Microsoft auth failed' });
    }
  });

  // Microsoft OAuth Callback
  app.get('/api/microsoft/auth/callback', isAuthenticated, async (req, res) => {
    try {
      const { userId } = await getUserContext(req);
      console.log('[Microsoft Auth] Callback started for user:', userId);
      
      const { code, state, error, error_description } = req.query;
      
      if (error) {
        console.error('[Microsoft Auth] OAuth error:', error, error_description);
        return res.redirect('/#/integracoes/microsoft?error=' + encodeURIComponent(error_description as string || 'Authentication failed'));
      }
      
      if (!code || !state || state !== req.session.msOAuthState) {
        console.error('[Microsoft Auth] State validation failed. Expected:', req.session.msOAuthState, 'Got:', state);
        return res.redirect('/#/integracoes/microsoft?error=invalid_state');
      }
      
      console.log('[Microsoft Auth] State validated successfully');
      
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      const redirectUri = `${req.protocol}://${req.get('host')}/api/microsoft/auth/callback`;
      
      console.log('[Microsoft Auth] Client ID:', clientId ? clientId.substring(0, 10) + '...' : 'MISSING');
      console.log('[Microsoft Auth] Client Secret length:', clientSecret?.length || 0);
      console.log('[Microsoft Auth] Client Secret:', clientSecret ? clientSecret.substring(0, 10) + '...' : 'MISSING');
      
      if (!clientId || !clientSecret) {
        console.error('[Microsoft Auth] Missing client credentials');
        return res.status(500).json({ message: 'Microsoft OAuth not configured' });
      }
      
      console.log('[Microsoft Auth] Exchanging code for tokens...');
      
      const tokenEndpoint = 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token';
      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Microsoft Auth] Token exchange failed:', errorText);
        return res.redirect('/#/integracoes/microsoft?error=token_exchange_failed');
      }
      
      const tokenData = await response.json();
      console.log('[Microsoft Auth] Tokens received, storing in database...');
      
      const { storeMicrosoftTokens, getMicrosoftTokens } = await import('./microsoft');
      
      await storeMicrosoftTokens(userId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      });
      
      const storedTokens = await getMicrosoftTokens(userId);
      if (!storedTokens) {
        console.error('[Microsoft Auth] Failed to verify token storage');
        return res.redirect('/#/integracoes/microsoft?error=token_storage_failed');
      }
      
      console.log('[Microsoft Auth] Tokens stored successfully');
      
      delete req.session.msOAuthState;
      
      req.session.save((err) => {
        if (err) {
          console.error('[Microsoft Auth] Session save error:', err);
          return res.redirect('/#/integracoes/microsoft?error=session_save_failed');
        }
        
        console.log('[Microsoft Auth] Session saved, redirecting to success page');
        res.redirect('/#/integracoes/microsoft?success=true');
      });
    } catch (error) {
      console.error('[Microsoft Auth] Callback error:', error);
      res.redirect('/#/integracoes/microsoft?error=callback_failed');
    }
  });

  // Microsoft Device Flow - Start
  app.post('/api/microsoft/auth/device-flow/start', isAuthenticated, async (req, res) => {
    try {
      const clientId = process.env.MICROSOFT_CLIENT_ID;
      if (!clientId) {
        return res.status(500).json({ message: 'Microsoft OAuth not configured' });
      }

      const scopes = ['User.Read', 'Tasks.ReadWrite', 'offline_access'];
      
      const params = new URLSearchParams({
        client_id: clientId,
        scope: scopes.join(' '),
      });

      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/devicecode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Microsoft Auth] Device code request failed:', response.status, errorText);
        return res.status(500).json({ message: 'Failed to initiate device flow', error: errorText });
      }

      const data = await response.json();
      console.log('[Microsoft Auth] Device flow initiated successfully');
      
      res.json({
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresIn: data.expires_in,
        pollInterval: data.interval || 5,
      });
    } catch (error) {
      console.error('[Microsoft Auth] Device flow start error:', error);
      res.status(500).json({ message: 'Device flow initiation failed' });
    }
  });

  // Microsoft Device Flow - Poll
  app.get('/api/microsoft/auth/device-flow/poll/:deviceCode', isAuthenticated, async (req, res) => {
    try {
      const { userId } = await getUserContext(req);
      const { deviceCode } = req.params;

      const clientId = process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(500).json({ message: 'Microsoft OAuth not configured' });
      }

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (response.status === 400) {
        const error = await response.json();
        if (error.error === 'authorization_pending') {
          return res.status(400).json({ message: 'Authorization pending' });
        }
        if (error.error === 'slow_down') {
          return res.status(429).json({ message: 'Slow down' });
        }
        if (error.error === 'expired_token') {
          return res.status(410).json({ message: 'Device code expired' });
        }
      }

      if (!response.ok) {
        throw new Error('Token request failed');
      }

      const tokenData = await response.json();

      const { storeMicrosoftTokens, getMicrosoftTokens } = await import('./microsoft');
      
      await storeMicrosoftTokens(userId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scopes: tokenData.scope ? tokenData.scope.split(' ') : [],
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      });

      const storedTokens = await getMicrosoftTokens(userId);
      if (!storedTokens) {
        return res.status(500).json({ message: 'Token storage failed' });
      }

      console.log('[Microsoft Auth] Device Flow successful for user:', userId);
      res.json({ connected: true });
    } catch (error) {
      console.error('[Microsoft Auth] Device flow poll error:', error);
      res.status(500).json({ message: 'Device flow poll failed' });
    }
  });

  // Microsoft Disconnect
  app.post('/api/microsoft/auth/disconnect', isAuthenticated, async (req, res) => {
    try {
      const { userId } = await getUserContext(req);
      
      const { deleteMicrosoftTokens } = await import('./microsoft');
      
      await deleteMicrosoftTokens(userId);
      
      res.json({ message: 'Microsoft account disconnected' });
    } catch (error) {
      console.error('[Microsoft Auth] Disconnect error:', error);
      res.status(500).json({ message: 'Failed to disconnect Microsoft account' });
    }
  });

  // Get Microsoft Connection Status
  app.get('/api/microsoft/auth/status', isAuthenticated, async (req, res) => {
    try {
      const { userId } = await getUserContext(req);
      
      const { getMicrosoftTokens } = await import('./microsoft');
      
      const tokens = await getMicrosoftTokens(userId);
      
      if (tokens) {
        res.json({
          connected: true,
          scopes: tokens.scopes,
          expiresAt: tokens.expiresAt,
        });
      } else {
        res.json({ connected: false });
      }
    } catch (error) {
      console.error('[Microsoft Auth] Status error:', error);
      res.status(500).json({ message: 'Failed to get Microsoft status' });
    }
  });

  // Get Microsoft Planner Groups
  app.get('/api/microsoft/planner/groups', isAuthenticated, async (req, res) => {
    try {
      const { userId } = await getUserContext(req);
      
      const { createMicrosoftGraphClient } = await import('./microsoft');
      
      const client = await createMicrosoftGraphClient(userId);
      const groups = await client.get('/me/joinedTeams');
      
      res.json(groups.value || []);
    } catch (error: any) {
      console.error('[Microsoft Planner] Get groups error:', error);
      if (error.message.includes('not connected')) {
        return res.status(401).json({ message: 'Microsoft account not connected' });
      }
      if (error.message.includes('Insufficient privileges') || error.message.includes('Access is denied')) {
        return res.status(403).json({ 
          message: 'Insufficient permissions for Planner',
          needsAdminConsent: true 
        });
      }
      res.status(500).json({ message: 'Failed to get Microsoft groups' });
    }
  });

  // Get Microsoft Planner Plans for a Group
  app.get('/api/microsoft/planner/plans/:groupId', isAuthenticated, async (req, res) => {
    try {
      const { groupId } = req.params;
      const { userId } = await getUserContext(req);
      
      const { createMicrosoftGraphClient } = await import('./microsoft');
      
      const client = await createMicrosoftGraphClient(userId);
      const plans = await client.get(`/groups/${groupId}/planner/plans`);
      
      res.json(plans.value || []);
    } catch (error: any) {
      console.error('[Microsoft Planner] Get plans error:', error);
      if (error.message.includes('not connected')) {
        return res.status(401).json({ message: 'Microsoft account not connected' });
      }
      if (error.message.includes('Insufficient privileges') || error.message.includes('Access is denied')) {
        return res.status(403).json({ 
          message: 'Insufficient permissions for Planner',
          needsAdminConsent: true 
        });
      }
      res.status(500).json({ message: 'Failed to get planner plans' });
    }
  });

  // Get Microsoft Planner Buckets for a Plan
  app.get('/api/microsoft/planner/buckets/:planId', isAuthenticated, async (req, res) => {
    try {
      const { planId } = req.params;
      const { userId } = await getUserContext(req);
      
      const { createMicrosoftGraphClient } = await import('./microsoft');
      
      const client = await createMicrosoftGraphClient(userId);
      const buckets = await client.get(`/planner/plans/${planId}/buckets`);
      
      res.json(buckets.value || []);
    } catch (error: any) {
      console.error('[Microsoft Planner] Get buckets error:', error);
      if (error.message.includes('not connected')) {
        return res.status(401).json({ message: 'Microsoft account not connected' });
      }
      if (error.message.includes('Insufficient privileges') || error.message.includes('Access is denied')) {
        return res.status(403).json({ 
          message: 'Insufficient permissions for Planner',
          needsAdminConsent: true 
        });
      }
      res.status(500).json({ message: 'Failed to get planner buckets' });
    }
  });

  // Export Task to Planner
  app.post('/api/microsoft/planner/export/:tarefaId', isAuthenticated, async (req, res) => {
    try {
      const { tarefaId } = req.params;
      const { planId, bucketId } = req.body;
      const { userId, userRole } = await getUserContext(req);
      
      if (!planId || !bucketId) {
        return res.status(400).json({ message: 'Plan ID and Bucket ID required' });
      }
      
      const tarefa = await storage.getTarefa(tarefaId, userId, userRole);
      if (!tarefa) {
        return res.status(404).json({ message: 'Tarefa not found' });
      }
      
      const { createMicrosoftGraphClient } = await import('./microsoft');
      const client = await createMicrosoftGraphClient(userId);
      
      const entidadeName = tarefa.entidadeId ? (await storage.getEntidade(tarefa.entidadeId, userId, userRole))?.nome : '';
      const visitaInfo = tarefa.visitaId ? (await storage.getVisita(tarefa.visitaId, userId, userRole)) : null;
      
      const appUrl = `${req.protocol}://${req.get('host')}`;
      let description = `Link: ${appUrl}/#/tarefas/${tarefa.id}\n\n`;
      if (entidadeName) description += `Entidade: ${entidadeName}\n`;
      if (visitaInfo) description += `Visita relacionada\n`;
      if (tarefa.descricao) description += `\n${tarefa.descricao}`;
      
      const msUser = await client.get('/me');
      
      const plannerTask = await client.post('/planner/tasks', {
        planId,
        bucketId,
        title: tarefa.titulo,
        dueDateTime: tarefa.dueDate ? tarefa.dueDate.toISOString() : null,
        assignments: {
          [msUser.id]: {
            '@odata.type': '#microsoft.graph.plannerAssignment',
            orderHint: ' !',
          },
        },
      });
      
      await client.patch(`/planner/tasks/${plannerTask.id}/details`, {
        description,
      });
      
      await storage.updateTarefaMicrosoftFields(tarefaId, {
        plannerTaskId: plannerTask.id,
        plannerPlanId: planId,
        plannerBucketId: bucketId,
        microsoftUserId: msUser.id,
        lastPlannerSyncAt: new Date(),
      });
      
      res.json({ message: 'Tarefa enviada para o Planner', plannerTaskId: plannerTask.id });
    } catch (error: any) {
      console.error('[Microsoft Planner] Export error:', error);
      if (error.message.includes('not connected')) {
        return res.status(401).json({ message: 'Microsoft account not connected' });
      }
      if (error.message.includes('Insufficient privileges') || error.message.includes('Access is denied')) {
        return res.status(403).json({ 
          message: 'Sem permissões para exportar para o Planner. Por favor, use o Microsoft To-Do.',
          needsAdminConsent: true 
        });
      }
      res.status(500).json({ message: 'Failed to export to Planner' });
    }
  });

  // Export Task to Microsoft To-Do
  app.post('/api/microsoft/todo/export/:tarefaId', isAuthenticated, async (req, res) => {
    try {
      const { tarefaId } = req.params;
      const { userId, userRole } = await getUserContext(req);
      
      const tarefa = await storage.getTarefa(tarefaId, userId, userRole);
      if (!tarefa) {
        return res.status(404).json({ message: 'Tarefa not found' });
      }
      
      const { createMicrosoftGraphClient } = await import('./microsoft');
      const client = await createMicrosoftGraphClient(userId);
      
      const lists = await client.get('/me/todo/lists');
      const defaultList = lists.value?.find((l: any) => l.wellknownListName === 'defaultList') || lists.value?.[0];
      
      if (!defaultList) {
        return res.status(500).json({ message: 'No To-Do list found' });
      }
      
      const appUrl = `${req.protocol}://${req.get('host')}`;
      const entidadeName = tarefa.entidadeId ? (await storage.getEntidade(tarefa.entidadeId, userId, userRole))?.nome : '';
      
      let bodyContent = `Link: ${appUrl}/#/tarefas/${tarefa.id}\n\n`;
      if (entidadeName) bodyContent += `Entidade: ${entidadeName}\n`;
      if (tarefa.descricao) bodyContent += `\n${tarefa.descricao}`;
      
      const categories: string[] = [];
      if (entidadeName) categories.push(entidadeName);
      
      const todoTask = await client.post(`/me/todo/lists/${defaultList.id}/tasks`, {
        title: tarefa.titulo,
        body: {
          content: bodyContent,
          contentType: 'text',
        },
        dueDateTime: tarefa.dueDate ? {
          dateTime: tarefa.dueDate.toISOString(),
          timeZone: 'UTC',
        } : null,
        categories: categories.length > 0 ? categories : undefined,
      });
      
      await storage.updateTarefaMicrosoftFields(tarefaId, {
        todoTaskId: todoTask.id,
        lastTodoSyncAt: new Date(),
      });
      
      res.json({ message: 'Tarefa criada no Microsoft To-Do', todoTaskId: todoTask.id });
    } catch (error: any) {
      console.error('[Microsoft To-Do] Export error:', error);
      if (error.message.includes('not connected')) {
        return res.status(401).json({ message: 'Microsoft account not connected' });
      }
      res.status(500).json({ message: 'Failed to export to To-Do' });
    }
  });

  // Export Visit to Outlook Calendar
  app.post('/api/microsoft/calendar/export/:visitaId', isAuthenticated, async (req, res) => {
    try {
      const { visitaId } = req.params;
      const { startDateTime } = req.body;
      const { userId, userRole } = await getUserContext(req);
      
      if (!startDateTime) {
        return res.status(400).json({ message: 'Start date/time required' });
      }
      
      const visita = await storage.getVisita(visitaId, userId, userRole);
      if (!visita) {
        return res.status(404).json({ message: 'Visita not found' });
      }
      
      const { createMicrosoftGraphClient } = await import('./microsoft');
      const client = await createMicrosoftGraphClient(userId);
      
      const entidade = visita.entidadeId ? await storage.getEntidade(visita.entidadeId, userId, userRole) : null;
      const appUrl = `${req.protocol}://${req.get('host')}`;
      
      const start = new Date(startDateTime);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      
      let bodyContent = `Link: ${appUrl}/#/visitas/${visita.id}\n\n`;
      if (visita.resumoIa) bodyContent += `Resumo:\n${visita.resumoIa}\n\n`;
      if (visita.notas) bodyContent += `Notas:\n${visita.notas}\n\n`;
      if (visita.marcasEntregues && visita.marcasEntregues.length > 0) {
        bodyContent += `Marcas entregues: ${visita.marcasEntregues.join(', ')}\n`;
      }
      
      const event = await client.post('/me/events', {
        subject: `Visita - ${entidade?.nome || 'Entidade'}`,
        body: {
          contentType: 'text',
          content: bodyContent,
        },
        start: {
          dateTime: start.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: 'UTC',
        },
        location: entidade?.morada ? {
          displayName: entidade.morada,
        } : undefined,
        isReminderOn: true,
        reminderMinutesBeforeStart: 30,
        isOnlineMeeting: false,
      });
      
      await storage.updateVisitaMicrosoftFields(visitaId, {
        outlookEventId: event.id,
        lastCalendarSyncAt: new Date(),
      });
      
      res.json({ message: 'Evento adicionado ao Outlook', eventId: event.id });
    } catch (error: any) {
      console.error('[Microsoft Calendar] Export error:', error);
      if (error.message.includes('not connected')) {
        return res.status(401).json({ message: 'Microsoft account not connected' });
      }
      res.status(500).json({ message: 'Failed to export to Outlook Calendar' });
    }
  });
  
  */

  // ============================================
  // PDF PRO EXPORTS ROUTES
  // ============================================

  // GET /api/pdf/visita/:id/pro - Relatório PRO de visita
  app.get('/api/pdf/visita/:id/pro', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, userRole } = await getUserContext(req);
      const { includePhotos, includeTasks, includeIA, includeCharts, type } = req.query;
      
      const visita = await storage.getVisita(id, userId, userRole);
      if (!visita) {
        return res.status(404).json({ message: 'Visita não encontrada' });
      }
      
      const entidade = visita.entidadeId ? await storage.getEntidade(visita.entidadeId, userId, userRole) : null;
      const contacto = visita.contactoId ? await storage.getContacto(visita.contactoId, userId, userRole) : null;
      const tarefas = await storage.getTarefasByVisitaId(id, userId, userRole);
      const recentVisits = entidade ? await storage.getVisitasByEntidade(entidade.id, userId, userRole) : [];
      
      const { generateVisitaPDFPro } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: includePhotos !== 'false',
        includeTasks: includeTasks !== 'false',
        includeIA: includeIA !== 'false',
        includeCharts: includeCharts !== 'false',
        type: (type === 'cliente' ? 'cliente' : 'interno') as 'interno' | 'cliente'
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateVisitaPDFPro(visita, entidade, contacto, tarefas, recentVisits, options, openaiClient);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="visita-pro-${id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF PRO] Error generating visit PDF:', error);
      res.status(500).json({ message: 'Erro ao gerar PDF PRO da visita' });
    }
  });

  // GET /api/pdf/entidade/:id/pro - Relatório PRO de entidade
  app.get('/api/pdf/entidade/:id/pro', isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId, userRole } = await getUserContext(req);
      const { includePhotos, includeTasks, includeIA, includeCharts, type } = req.query;
      
      const entidade = await storage.getEntidade(id, userId, userRole);
      if (!entidade) {
        return res.status(404).json({ message: 'Entidade não encontrada' });
      }
      
      const allContactos = await storage.getContactos(userId, userRole);
      const contactos = allContactos.filter(c => c.entidadeId === id);
      const visitas = await storage.getVisitasByEntidade(id, userId, userRole);
      const tarefas = await storage.getTarefasByEntidadeId(id, userId, userRole);
      
      const { generateEntidadePDFPro } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: includePhotos !== 'false',
        includeTasks: includeTasks !== 'false',
        includeIA: includeIA !== 'false',
        includeCharts: includeCharts !== 'false',
        type: (type === 'cliente' ? 'cliente' : 'interno') as 'interno' | 'cliente'
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateEntidadePDFPro(entidade, contactos, visitas, tarefas, options, openaiClient);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="entidade-pro-${entidade.nome?.replace(/[^a-z0-9]/gi, '_')}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF PRO] Error generating entidade PDF:', error);
      res.status(500).json({ message: 'Erro ao gerar PDF PRO da entidade' });
    }
  });

  // GET /api/pdf/agente/:id/relatorio-mensal - Relatório mensal do agente
  app.get('/api/pdf/agente/:id/relatorio-mensal', isAuthenticated, async (req, res) => {
    try {
      const { id: targetUserId } = req.params;
      const { userId, userRole } = await getUserContext(req);
      const { year, month, includePhotos, includeTasks, includeIA, includeCharts } = req.query;
      
      // RBAC: Agente só pode ver seus próprios relatórios, admin pode ver todos
      if (userRole !== 'admin' && userId !== targetUserId) {
        return res.status(403).json({ message: 'Sem permissão para aceder este relatório' });
      }
      
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth();
      
      const periodStart = startOfMonth(new Date(targetYear, targetMonth));
      const periodEnd = endOfMonth(new Date(targetYear, targetMonth));
      
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, targetUserId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, targetUserId, userRole);
      const entidades = await storage.getAllEntidades(targetUserId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: includePhotos !== 'false',
        includeTasks: includeTasks !== 'false',
        includeIA: includeIA !== 'false',
        includeCharts: includeCharts !== 'false',
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        targetUserId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-mensal-${targetMonth + 1}-${targetYear}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF PRO] Error generating monthly report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório mensal' });
    }
  });

  // GET /api/pdf/agente/:id/relatorio-semanal - Relatório semanal do agente
  app.get('/api/pdf/agente/:id/relatorio-semanal', isAuthenticated, async (req, res) => {
    try {
      const { id: targetUserId } = req.params;
      const { userId, userRole } = await getUserContext(req);
      const { date, includePhotos, includeTasks, includeIA, includeCharts } = req.query;
      
      // RBAC: Agente só pode ver seus próprios relatórios, admin pode ver todos
      if (userRole !== 'admin' && userId !== targetUserId) {
        return res.status(403).json({ message: 'Sem permissão para aceder este relatório' });
      }
      
      const referenceDate = date ? new Date(date as string) : new Date();
      const periodStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const periodEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, targetUserId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, targetUserId, userRole);
      const entidades = await storage.getAllEntidades(targetUserId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: includePhotos !== 'false',
        includeTasks: includeTasks !== 'false',
        includeIA: includeIA !== 'false',
        includeCharts: includeCharts !== 'false',
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        targetUserId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-semanal-${format(periodStart, 'dd-MM-yyyy', { locale: pt })}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF PRO] Error generating weekly report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório semanal' });
    }
  });

  // GET /api/pdf/empresa/relatorio-mensal - Relatório mensal da empresa (Admin only)
  app.get('/api/pdf/empresa/relatorio-mensal', isAuthenticated, async (req, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { year, month, includePhotos, includeTasks, includeIA, includeCharts } = req.query;
      
      // RBAC: Admin only
      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Relatórios da empresa requerem privilégios de admin' });
      }
      
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth();
      
      const periodStart = startOfMonth(new Date(targetYear, targetMonth));
      const periodEnd = endOfMonth(new Date(targetYear, targetMonth));
      
      // Admin vê tudo
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, userId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, userId, userRole);
      const entidades = await storage.getAllEntidades(userId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: includePhotos !== 'false',
        includeTasks: includeTasks !== 'false',
        includeIA: includeIA !== 'false',
        includeCharts: includeCharts !== 'false',
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-empresa-${targetMonth + 1}-${targetYear}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF PRO] Error generating company report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório da empresa' });
    }
  });

  // ========== SIMPLIFIED PDF REPORT ENDPOINTS (RESTful) ==========
  
  // GET /api/pdf/reports/monthly/agent - Relatório mensal do agente atual
  app.get('/api/pdf/reports/monthly/agent', isAuthenticated, async (req, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { year, month } = req.query;
      
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth();
      
      const periodStart = startOfMonth(new Date(targetYear, targetMonth));
      const periodEnd = endOfMonth(new Date(targetYear, targetMonth));
      
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, userId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, userId, userRole);
      const entidades = await storage.getAllEntidades(userId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: true,
        includeTasks: true,
        includeIA: true,
        includeCharts: true,
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-mensal-${targetMonth + 1}-${targetYear}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF] Error generating monthly agent report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório mensal' });
    }
  });

  // GET /api/pdf/reports/weekly/agent - Relatório semanal do agente atual
  app.get('/api/pdf/reports/weekly/agent', isAuthenticated, async (req, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { date } = req.query;
      
      const referenceDate = date ? new Date(date as string) : new Date();
      const periodStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const periodEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, userId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, userId, userRole);
      const entidades = await storage.getAllEntidades(userId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: true,
        includeTasks: true,
        includeIA: true,
        includeCharts: true,
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-semanal-${format(periodStart, 'dd-MM-yyyy', { locale: pt })}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF] Error generating weekly agent report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório semanal' });
    }
  });

  // GET /api/pdf/reports/monthly/company - Relatório mensal da empresa (Admin only)
  app.get('/api/pdf/reports/monthly/company', isAuthenticated, async (req, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { year, month } = req.query;
      
      // RBAC: Admin only
      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Relatórios da empresa requerem privilégios de admin' });
      }
      
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) - 1 : new Date().getMonth();
      
      const periodStart = startOfMonth(new Date(targetYear, targetMonth));
      const periodEnd = endOfMonth(new Date(targetYear, targetMonth));
      
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, userId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, userId, userRole);
      const entidades = await storage.getAllEntidades(userId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: true,
        includeTasks: true,
        includeIA: true,
        includeCharts: true,
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-empresa-mensal-${targetMonth + 1}-${targetYear}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF] Error generating monthly company report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório da empresa' });
    }
  });

  // GET /api/pdf/reports/weekly/company - Relatório semanal da empresa (Admin only)
  app.get('/api/pdf/reports/weekly/company', isAuthenticated, async (req, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { date } = req.query;
      
      // RBAC: Admin only
      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Relatórios da empresa requerem privilégios de admin' });
      }
      
      const referenceDate = date ? new Date(date as string) : new Date();
      const periodStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const periodEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      
      const visitas = await storage.getVisitasInPeriod(periodStart, periodEnd, userId, userRole);
      const tarefas = await storage.getTarefasInPeriod(periodStart, periodEnd, userId, userRole);
      const entidades = await storage.getAllEntidades(userId, userRole);
      
      const { generateMonthlyReportPDF } = await import('./pdfPro');
      const { getOpenAIClient } = await import('./openai');
      
      const options = {
        includePhotos: true,
        includeTasks: true,
        includeIA: true,
        includeCharts: true,
        type: 'interno' as const
      };
      
      const openaiClient = getOpenAIClient();
      const pdfBuffer = await generateMonthlyReportPDF(
        { start: periodStart, end: periodEnd },
        visitas,
        tarefas,
        entidades,
        userId,
        userRole,
        options,
        openaiClient
      );
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio-empresa-semanal-${format(periodStart, 'dd-MM-yyyy', { locale: pt })}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('[PDF] Error generating weekly company report:', error);
      res.status(500).json({ message: 'Erro ao gerar relatório da empresa' });
    }
  });

  // ============================================
  // FASE 3: Backoffice Admin API
  // ============================================

  // GET /api/admin/empresa - Get current company config
  app.get('/api/admin/empresa', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const empresa = await storage.getEmpresa(empresaId);
      if (!empresa) {
        return res.status(404).json({ message: "Empresa not found" });
      }
      res.json(empresa);
    } catch (error) {
      console.error("Error fetching empresa:", error);
      res.status(500).json({ message: "Failed to fetch empresa" });
    }
  });

  // PATCH /api/admin/empresa - Update company config
  app.patch('/api/admin/empresa', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const { nome, nif, email, telefone, logoUrl, mostrarMarcasEmVisitas, theme } = req.body;
      
      // Validate theme if provided
      if (theme !== undefined && !["light-business", "dark-pro"].includes(theme)) {
        return res.status(400).json({ message: "Invalid theme. Must be 'light-business' or 'dark-pro'" });
      }
      
      const updateData: Partial<Empresa> = {};
      if (nome !== undefined) updateData.nome = nome;
      if (nif !== undefined) updateData.nif = nif;
      if (email !== undefined) updateData.email = email;
      if (telefone !== undefined) updateData.telefone = telefone;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (mostrarMarcasEmVisitas !== undefined) updateData.mostrarMarcasEmVisitas = mostrarMarcasEmVisitas;
      if (theme !== undefined) updateData.theme = theme;
      
      const updated = await storage.updateEmpresa(empresaId, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Empresa not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating empresa:", error);
      res.status(500).json({ message: "Failed to update empresa" });
    }
  });

  // GET /api/admin/utilizadores - List all users in company
  app.get('/api/admin/utilizadores', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const utilizadores = await storage.getUtilizadoresByEmpresa(empresaId);
      res.json(utilizadores);
    } catch (error) {
      console.error("Error fetching utilizadores:", error);
      res.status(500).json({ message: "Failed to fetch utilizadores" });
    }
  });

  // POST /api/admin/utilizadores - Create new user
  app.post('/api/admin/utilizadores', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const { email, firstName, lastName, role } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // FASE 3: Create user with company
      const newUser = await storage.createUtilizador({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        role: role || 'agent',
        empresaId,
        ativo: true,
      });
      
      res.json(newUser);
    } catch (error) {
      console.error("Error creating utilizador:", error);
      res.status(400).json({ message: "Failed to create utilizador" });
    }
  });

  // PATCH /api/admin/utilizadores/:id - Update user
  app.patch('/api/admin/utilizadores/:id', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const { role, ativo } = req.body;
      
      const updateData: Partial<User> = {};
      if (role !== undefined && ['admin', 'agent'].includes(role)) {
        updateData.role = role;
      }
      if (ativo !== undefined) {
        updateData.ativo = ativo;
      }
      
      const updated = await storage.updateUtilizador(req.params.id, updateData, empresaId);
      if (!updated) {
        return res.status(404).json({ message: "Utilizador not found or unauthorized" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating utilizador:", error);
      res.status(500).json({ message: "Failed to update utilizador" });
    }
  });

  // GET /api/admin/marcas - List all brands (admin only)
  app.get('/api/admin/marcas', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const marcas = await storage.getMarcasByEmpresa(empresaId);
      res.json(marcas);
    } catch (error) {
      console.error("Error fetching marcas:", error);
      res.status(500).json({ message: "Failed to fetch marcas" });
    }
  });

  // POST /api/admin/marcas - Create new brand
  app.post('/api/admin/marcas', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const { nome, codigo, descricao, logoUrl, ativa } = req.body;
      
      if (!nome) {
        return res.status(400).json({ message: "Brand name is required" });
      }
      
      // FASE 3: Create marca with company
      const newMarca = await storage.createMarca({
        empresaId,
        nome,
        codigo: codigo || null,
        descricao: descricao || null,
        logoUrl: logoUrl || null,
        ativa: ativa !== false, // default true
      });
      
      res.json(newMarca);
    } catch (error) {
      console.error("Error creating marca:", error);
      res.status(400).json({ message: "Failed to create marca" });
    }
  });

  // PATCH /api/admin/marcas/:id - Update brand
  app.patch('/api/admin/marcas/:id', requireAdmin, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const { nome, codigo, descricao, logoUrl, ativa } = req.body;
      
      const updateData: Partial<Marca> = {};
      if (nome !== undefined) updateData.nome = nome;
      if (codigo !== undefined) updateData.codigo = codigo;
      if (descricao !== undefined) updateData.descricao = descricao;
      if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
      if (ativa !== undefined) updateData.ativa = ativa;
      
      const updated = await storage.updateMarca(req.params.id, updateData, empresaId);
      if (!updated) {
        return res.status(404).json({ message: "Marca not found or unauthorized" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating marca:", error);
      res.status(500).json({ message: "Failed to update marca" });
    }
  });

  // GET /api/marcas - List active brands (public endpoint, authenticated but no admin required)
  app.get('/api/marcas', isAuthenticated, async (req: any, res) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      
      const onlyAtivas = req.query.onlyAtivas === 'true';
      
      const marcas = onlyAtivas 
        ? await storage.getMarcasByEmpresaAtiva(empresaId)
        : await storage.getMarcasByEmpresa(empresaId);
      
      res.json(marcas);
    } catch (error) {
      console.error("Error fetching marcas:", error);
      res.status(500).json({ message: "Failed to fetch marcas" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', isAuthenticated, (req, res, next) => {
    const filePath = path.join('/tmp/uploads', req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

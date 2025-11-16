import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { transcribeAudio, generateVisitSummary } from "./openai";
import { sendVisitEmail } from "./email";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { insertEntidadeSchema, insertGabineteSchema, insertContactoSchema, insertVisitaSchema, insertTarefaSchema } from "@shared/schema";
import express from "express";

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
    const allowedMimes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|ogg|m4a/;
    const extname = allowedMimes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only images, videos, and audio files are allowed.'));
  },
});

// Helper function to get user ID and role from request
async function getUserContext(req: any): Promise<{ userId: string; userRole: 'admin' | 'agent' }> {
  const userId = req.user.claims.sub;
  const user = await storage.getUser(userId);
  const userRole = user?.role || 'agent'; // Default to 'agent' if not set
  return { userId, userRole };
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
      res.json(user);
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

  // Dashboard endpoint
  app.get('/api/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const stats = await storage.getDashboardStats(userId, userRole);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Analytics endpoint
  app.get('/api/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      
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

      const analytics = await storage.getAnalytics(userId, userRole, filters);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Entidades endpoints (Universal Entities)
  app.get('/api/entidades', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const entidades = await storage.getEntidades(userId, userRole);
      res.json(entidades);
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ message: "Failed to fetch entidades" });
    }
  });

  app.get('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const entidade = await storage.getEntidade(req.params.id, userId, userRole);
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
      const { userId } = await getUserContext(req);
      const validatedData = insertEntidadeSchema.parse(req.body);
      // Set createdByUserId to current user
      const entidade = await storage.createEntidade({
        ...validatedData,
        createdByUserId: userId,
      });
      res.json(entidade);
    } catch (error) {
      console.error("Error creating entidade:", error);
      res.status(400).json({ message: "Failed to create entidade" });
    }
  });

  app.patch('/api/entidades/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const validatedData = insertEntidadeSchema.partial().parse(req.body);
      const entidade = await storage.updateEntidade(req.params.id, validatedData, userId, userRole);
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
      const { userId, userRole } = await getUserContext(req);
      
      // Check if entidade has related contacts or visits
      const hasRelations = await storage.checkEntidadeHasRelations(req.params.id);
      if (hasRelations) {
        return res.status(400).json({ 
          message: "Não é possível eliminar. Esta entidade tem contactos ou visitas associadas." 
        });
      }
      
      await storage.deleteEntidade(req.params.id, userId, userRole);
      res.json({ message: "Entidade deleted" });
    } catch (error) {
      console.error("Error deleting entidade:", error);
      res.status(500).json({ message: "Failed to delete entidade" });
    }
  });

  // Gabinetes endpoints (DEPRECATED - use /api/entidades)
  app.get('/api/gabinetes', isAuthenticated, async (req, res) => {
    try {
      const gabinetes = await storage.getGabinetes();
      res.json(gabinetes);
    } catch (error) {
      console.error("Error fetching gabinetes:", error);
      res.status(500).json({ message: "Failed to fetch gabinetes" });
    }
  });

  app.get('/api/gabinetes/:id', isAuthenticated, async (req, res) => {
    try {
      const gabinete = await storage.getGabinete(req.params.id);
      if (!gabinete) {
        return res.status(404).json({ message: "Gabinete not found" });
      }
      res.json(gabinete);
    } catch (error) {
      console.error("Error fetching gabinete:", error);
      res.status(500).json({ message: "Failed to fetch gabinete" });
    }
  });

  app.post('/api/gabinetes', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertGabineteSchema.parse(req.body);
      const gabinete = await storage.createGabinete(validatedData);
      res.json(gabinete);
    } catch (error) {
      console.error("Error creating gabinete:", error);
      res.status(400).json({ message: "Failed to create gabinete" });
    }
  });

  app.patch('/api/gabinetes/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertGabineteSchema.partial().parse(req.body);
      const gabinete = await storage.updateGabinete(req.params.id, validatedData);
      res.json(gabinete);
    } catch (error) {
      console.error("Error updating gabinete:", error);
      res.status(400).json({ message: "Failed to update gabinete" });
    }
  });

  app.delete('/api/gabinetes/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteGabinete(req.params.id);
      res.json({ message: "Gabinete deleted" });
    } catch (error) {
      console.error("Error deleting gabinete:", error);
      res.status(500).json({ message: "Failed to delete gabinete" });
    }
  });

  // Contactos endpoints
  app.get('/api/contactos', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const contactos = await storage.getContactos(userId, userRole);
      res.json(contactos);
    } catch (error) {
      console.error("Error fetching contactos:", error);
      res.status(500).json({ message: "Failed to fetch contactos" });
    }
  });

  app.get('/api/contactos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const contacto = await storage.getContacto(req.params.id, userId, userRole);
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
      const { userId } = await getUserContext(req);
      const validatedData = insertContactoSchema.parse(req.body);
      // Set createdByUserId to current user
      const contacto = await storage.createContacto({
        ...validatedData,
        createdByUserId: userId,
      });
      res.json(contacto);
    } catch (error) {
      console.error("Error creating contacto:", error);
      res.status(400).json({ message: "Failed to create contacto" });
    }
  });

  app.patch('/api/contactos/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const validatedData = insertContactoSchema.partial().parse(req.body);
      const contacto = await storage.updateContacto(req.params.id, validatedData, userId, userRole);
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
      const { userId, userRole } = await getUserContext(req);
      await storage.deleteContacto(req.params.id, userId, userRole);
      res.json({ message: "Contacto deleted" });
    } catch (error) {
      console.error("Error deleting contacto:", error);
      res.status(500).json({ message: "Failed to delete contacto" });
    }
  });

  // vCard import endpoint with universal entity auto-creation
  app.post('/api/tools/vcard-import', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const { name, organization, email, phone, title, address, url, domain } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Contact name is required" });
      }

      let entidadeId: string | undefined;
      let entidadeStatus: 'existing' | 'created' | 'none' = 'none';
      let entidadeNome: string | undefined;

      // UNIVERSAL ENTITY AUTO-CREATION LOGIC
      // Step 1: Try to find existing entity by organization name
      if (organization) {
        const existingByName = await storage.findEntidadeByNome(organization, userId, userRole);
        if (existingByName) {
          entidadeId = existingByName.id;
          entidadeNome = existingByName.nome;
          entidadeStatus = 'existing';
        }
      }

      // Step 2: If not found and we have domain, try to find by domain
      if (!entidadeId && domain) {
        const existingByDomain = await storage.findEntidadeByDomain(domain, userId, userRole);
        if (existingByDomain) {
          entidadeId = existingByDomain.id;
          entidadeNome = existingByDomain.nome;
          entidadeStatus = 'existing';
        }
      }

      // Step 3: If still not found but we have clues, create new entity
      if (!entidadeId && (organization || domain)) {
        const entityName = organization || domain || 'Entidade Desconhecida';
        const newEntidade = await storage.createEntidade({
          nome: entityName,
          tipoEntidade: 'Outro',
          domain: domain || undefined,
          website: url || undefined,
          createdByUserId: userId,
          assignedUserId: userId,
        });
        entidadeId = newEntidade.id;
        entidadeNome = newEntidade.nome;
        entidadeStatus = 'created';
      }

      // Step 4: Always create contacto
      const contacto = await storage.createContacto({
        nome: name,
        email: email || undefined,
        telemovel: phone || undefined,
        funcao: title || undefined,
        entidadeId: entidadeId,
        createdByUserId: userId,
      });

      // Return comprehensive response
      res.json({
        contacto,
        entidade: entidadeId ? {
          id: entidadeId,
          nome: entidadeNome,
          status: entidadeStatus,
        } : null,
        message: entidadeStatus === 'created' 
          ? `Contacto e entidade "${entidadeNome}" criados automaticamente`
          : entidadeStatus === 'existing'
          ? `Contacto criado e associado à entidade "${entidadeNome}"`
          : "Contacto criado sem entidade associada",
      });
    } catch (error) {
      console.error("Error importing vCard:", error);
      res.status(500).json({ message: "Failed to import vCard" });
    }
  });

  // Visitas endpoints
  app.get('/api/visitas', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const visitas = await storage.getVisitas(userId, userRole);
      res.json(visitas);
    } catch (error) {
      console.error("Error fetching visitas:", error);
      res.status(500).json({ message: "Failed to fetch visitas" });
    }
  });

  app.get('/api/visitas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const visita = await storage.getVisita(req.params.id, userId, userRole);
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
      const { userId, userRole } = await getUserContext(req);
      const visita = await storage.getVisita(req.params.id, userId, userRole);
      
      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }

      // Fetch related tarefas
      const allTarefas = await storage.getTarefas(userId, userRole);
      const visitaTarefas = allTarefas.filter(t => t.visitaId === req.params.id);

      // Generate PDF using jsPDF
      const { generateVisitaPDF } = await import('./pdfGenerator.js');
      const pdfBuffer = await generateVisitaPDF(visita, visitaTarefas);

      // Set headers for PDF download
      const entidadeNome = visita.entidade?.nome || visita.gabinete?.nome || 'visita';
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
      const { userId, userRole } = await getUserContext(req);
      const visita = await storage.getVisita(req.params.id, userId, userRole);
      
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

  app.post('/api/visitas', isAuthenticated, upload.fields([
    { name: 'audio', maxCount: 1 },
    { name: 'media', maxCount: 10 }
  ]), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
        gabineteId: req.body.gabineteId,
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

      // Create visita
      const visita = await storage.createVisita(visitaData);

      // Generate AI summary asynchronously
      const { userRole } = await getUserContext(req);
      const visitaComplete = await storage.getVisita(visita.id, userId, userRole);
      if (visitaComplete) {
        try {
          const summary = await generateVisitSummary({
            notas: visitaData.notas || undefined,
            transcricaoAudio: visitaData.transcricaoAudio || undefined,
            marcasEntregues: visitaData.marcasEntregues,
            gabineteNome: visitaComplete.gabinete?.nome || '',
            contactoNome: visitaComplete.contacto?.nome,
          });
          
          await storage.updateVisita(visita.id, { resumoIa: summary });
          
          // Send email notification
          const user = await storage.getUser(userId);
          if (user?.email) {
            await sendVisitEmail({
              toEmail: user.email,
              gabineteNome: visitaComplete.gabinete?.nome || '',
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
      const { userId, userRole } = await getUserContext(req);
      await storage.deleteVisita(req.params.id, userId, userRole);
      res.json({ message: "Visita deleted" });
    } catch (error) {
      console.error("Error deleting visita:", error);
      res.status(500).json({ message: "Failed to delete visita" });
    }
  });

  // Tarefas (Tasks) endpoints
  app.get('/api/tarefas', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const filters = {
        status: req.query.status as string | undefined,
        assignedUserId: req.query.assignedUserId as string | undefined,
        entidadeId: req.query.entidadeId as string | undefined,
        overdue: req.query.overdue === 'true',
      };
      const tarefas = await storage.getTarefas(userId, userRole, filters);
      res.json(tarefas);
    } catch (error) {
      console.error("Error fetching tarefas:", error);
      res.status(500).json({ message: "Failed to fetch tarefas" });
    }
  });

  app.get('/api/tarefas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const tarefa = await storage.getTarefa(req.params.id, userId, userRole);
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
      const { userId } = await getUserContext(req);
      const validatedData = insertTarefaSchema.parse(req.body);
      
      const cleanedData = {
        ...validatedData,
        entidadeId: validatedData.entidadeId || null,
        visitaId: validatedData.visitaId || null,
        assignedUserId: validatedData.assignedUserId || null,
        dueDate: validatedData.dueDate || null,
        createdByUserId: userId,
      };
      
      const tarefa = await storage.createTarefa(cleanedData);
      res.json(tarefa);
    } catch (error) {
      console.error("Error creating tarefa:", error);
      res.status(400).json({ message: "Failed to create tarefa" });
    }
  });

  app.patch('/api/tarefas/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { userId, userRole } = await getUserContext(req);
      const validatedData = insertTarefaSchema.partial().parse(req.body);
      
      const cleanedData = {
        ...validatedData,
        ...(validatedData.entidadeId !== undefined && { entidadeId: validatedData.entidadeId || null }),
        ...(validatedData.visitaId !== undefined && { visitaId: validatedData.visitaId || null }),
        ...(validatedData.assignedUserId !== undefined && { assignedUserId: validatedData.assignedUserId || null }),
        ...(validatedData.dueDate !== undefined && { dueDate: validatedData.dueDate || null }),
      };
      
      const tarefa = await storage.updateTarefa(req.params.id, cleanedData, userId, userRole);
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
      const { userId, userRole } = await getUserContext(req);
      await storage.deleteTarefa(req.params.id, userId, userRole);
      res.json({ message: "Tarefa deleted" });
    } catch (error) {
      console.error("Error deleting tarefa:", error);
      res.status(500).json({ message: "Failed to delete tarefa" });
    }
  });

  // Marcas endpoints
  app.get('/api/marcas', isAuthenticated, async (req, res) => {
    try {
      const marcas = await storage.getMarcas();
      res.json(marcas);
    } catch (error) {
      console.error("Error fetching marcas:", error);
      res.status(500).json({ message: "Failed to fetch marcas" });
    }
  });

  app.post('/api/marcas', isAuthenticated, async (req, res) => {
    try {
      const marca = await storage.createMarca(req.body);
      res.json(marca);
    } catch (error) {
      console.error("Error creating marca:", error);
      res.status(400).json({ message: "Failed to create marca" });
    }
  });

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
  // POST /api/enrichment/autocomplete - Clearbit company autocomplete
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

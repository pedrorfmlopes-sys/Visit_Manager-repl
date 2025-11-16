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
import { insertEntidadeSchema, insertGabineteSchema, insertContactoSchema, insertVisitaSchema } from "@shared/schema";
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

  // Dashboard endpoint
  app.get('/api/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Entidades endpoints (Universal Entities)
  app.get('/api/entidades', isAuthenticated, async (req, res) => {
    try {
      const entidades = await storage.getEntidades();
      res.json(entidades);
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ message: "Failed to fetch entidades" });
    }
  });

  app.get('/api/entidades/:id', isAuthenticated, async (req, res) => {
    try {
      const entidade = await storage.getEntidade(req.params.id);
      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found" });
      }
      res.json(entidade);
    } catch (error) {
      console.error("Error fetching entidade:", error);
      res.status(500).json({ message: "Failed to fetch entidade" });
    }
  });

  app.post('/api/entidades', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertEntidadeSchema.parse(req.body);
      const entidade = await storage.createEntidade(validatedData);
      res.json(entidade);
    } catch (error) {
      console.error("Error creating entidade:", error);
      res.status(400).json({ message: "Failed to create entidade" });
    }
  });

  app.patch('/api/entidades/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertEntidadeSchema.partial().parse(req.body);
      const entidade = await storage.updateEntidade(req.params.id, validatedData);
      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found" });
      }
      res.json(entidade);
    } catch (error) {
      console.error("Error updating entidade:", error);
      res.status(400).json({ message: "Failed to update entidade" });
    }
  });

  app.delete('/api/entidades/:id', isAuthenticated, async (req, res) => {
    try {
      // Check if entidade has related contacts or visits
      const hasRelations = await storage.checkEntidadeHasRelations(req.params.id);
      if (hasRelations) {
        return res.status(400).json({ 
          message: "Não é possível eliminar. Esta entidade tem contactos ou visitas associadas." 
        });
      }
      
      await storage.deleteEntidade(req.params.id);
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
  app.get('/api/contactos', isAuthenticated, async (req, res) => {
    try {
      const contactos = await storage.getContactos();
      res.json(contactos);
    } catch (error) {
      console.error("Error fetching contactos:", error);
      res.status(500).json({ message: "Failed to fetch contactos" });
    }
  });

  app.get('/api/contactos/:id', isAuthenticated, async (req, res) => {
    try {
      const contacto = await storage.getContacto(req.params.id);
      if (!contacto) {
        return res.status(404).json({ message: "Contacto not found" });
      }
      res.json(contacto);
    } catch (error) {
      console.error("Error fetching contacto:", error);
      res.status(500).json({ message: "Failed to fetch contacto" });
    }
  });

  app.post('/api/contactos', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertContactoSchema.parse(req.body);
      const contacto = await storage.createContacto(validatedData);
      res.json(contacto);
    } catch (error) {
      console.error("Error creating contacto:", error);
      res.status(400).json({ message: "Failed to create contacto" });
    }
  });

  app.patch('/api/contactos/:id', isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertContactoSchema.partial().parse(req.body);
      const contacto = await storage.updateContacto(req.params.id, validatedData);
      res.json(contacto);
    } catch (error) {
      console.error("Error updating contacto:", error);
      res.status(400).json({ message: "Failed to update contacto" });
    }
  });

  app.delete('/api/contactos/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteContacto(req.params.id);
      res.json({ message: "Contacto deleted" });
    } catch (error) {
      console.error("Error deleting contacto:", error);
      res.status(500).json({ message: "Failed to delete contacto" });
    }
  });

  // Visitas endpoints
  app.get('/api/visitas', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const visitas = await storage.getVisitas(userId);
      res.json(visitas);
    } catch (error) {
      console.error("Error fetching visitas:", error);
      res.status(500).json({ message: "Failed to fetch visitas" });
    }
  });

  app.get('/api/visitas/:id', isAuthenticated, async (req, res) => {
    try {
      const visita = await storage.getVisita(req.params.id);
      if (!visita) {
        return res.status(404).json({ message: "Visita not found" });
      }
      res.json(visita);
    } catch (error) {
      console.error("Error fetching visita:", error);
      res.status(500).json({ message: "Failed to fetch visita" });
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
        contactoId: req.body.contactoId || null,
        userId: userId,
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
      const visitaComplete = await storage.getVisita(visita.id);
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

  app.delete('/api/visitas/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteVisita(req.params.id);
      res.json({ message: "Visita deleted" });
    } catch (error) {
      console.error("Error deleting visita:", error);
      res.status(500).json({ message: "Failed to delete visita" });
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

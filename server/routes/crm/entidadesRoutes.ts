import express, { type Request, type Response, type NextFunction } from "express";
import { storage } from "../../storage";
import { assertTenantReferences } from "../../tenantValidation";
import { resolveEntityResearchSettings } from "@shared/entityResearch";
import {
  lookupPortuguesePostalCode,
  searchAddress,
  validateVatWithVies,
} from "../../entityResearch";
import {
  getOdooPartnerById,
  searchOdooPartners,
} from "../../integrations/odooClient";
import { getOpenAIClient } from "../../openai";

const router = express.Router();

// ==========================================================
// Middleware helpers (locais a este módulo)
// ==========================================================
const isAuthenticated = (req: any, res: Response, next: NextFunction) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.session?.user || req.session.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

async function getUserContext(req: any) {
  return {
    userId: req.session?.user?.id || null,
    userRole: req.session?.user?.role || null,
    empresaId: req.session?.user?.empresaId || null,
  };
}

function normalizeEntityName(value: string): string {
  return value
    .toLocaleLowerCase("pt-PT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function entityNameSimilarity(firstValue: string, secondValue: string): number {
  const first = normalizeEntityName(firstValue);
  const second = normalizeEntityName(secondValue);
  if (!first || !second) return 0;
  if (first === second) return 1;
  if (first.includes(second) || second.includes(first)) return 0.85;

  const firstPairs = new Map<string, number>();
  for (let index = 0; index < first.length - 1; index += 1) {
    const pair = first.slice(index, index + 2);
    firstPairs.set(pair, (firstPairs.get(pair) ?? 0) + 1);
  }

  let intersection = 0;
  for (let index = 0; index < second.length - 1; index += 1) {
    const pair = second.slice(index, index + 2);
    const count = firstPairs.get(pair) ?? 0;
    if (count > 0) {
      intersection += 1;
      firstPairs.set(pair, count - 1);
    }
  }

  return (2 * intersection) / Math.max(1, first.length + second.length - 2);
}

router.post(
  "/api/enrichment/pt-intelligent-search",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const nome = typeof req.body?.nome === "string" ? req.body.nome.trim() : "";
      const existingEntityId =
        typeof req.body?.existingEntityId === "string"
          ? req.body.existingEntityId
          : undefined;

      if (!empresaId) {
        return res.status(400).json({ message: "User has no company assigned" });
      }
      if (nome.length < 3) {
        return res.json({
          fuzzyMatches: [],
          googleResults: [],
          enrichmentSource: "none",
        });
      }

      const entidades = await storage.getEntidades(
        empresaId,
        userId,
        userRole,
      );
      const fuzzyMatches = entidades
        .filter((entidade: any) => entidade.id !== existingEntityId)
        .map((entidade: any) => ({
          candidate: entidade.nome,
          score: entityNameSimilarity(nome, entidade.nome),
          id: entidade.id,
          type: "entidade" as const,
          domain: entidade.domain || undefined,
          logoUrl: entidade.logoUrl || undefined,
          website: entidade.website || undefined,
          morada: entidade.morada || undefined,
          telefone: entidade.telefone || undefined,
          email: entidade.email || undefined,
          nif: entidade.nif || undefined,
          cidade: entidade.cidade || undefined,
          codigoPostal: entidade.codigoPostal || undefined,
          countryCode: entidade.countryCode || "PT",
          source: "app" as const,
        }))
        .filter((match) => match.score >= 0.6)
        .sort((first, second) => second.score - first.score)
        .slice(0, 10);

      const empresa = await storage.getEmpresa(empresaId);
      const settings = resolveEntityResearchSettings(empresa?.uiSettings);
      let odooMatches: any[] = [];
      let odooUnavailable = false;

      if (settings.odooNameSearchEnabled && empresa?.odooCrmEnabled !== false) {
        try {
          const partners = await searchOdooPartners(empresaId, nome);
          odooMatches = partners
            .map((partner) => ({
              candidate: partner.name,
              score: entityNameSimilarity(nome, partner.name),
              id: `odoo-${partner.id}`,
              type: "entidade" as const,
              source: "odoo" as const,
              odooPartnerId: partner.id,
              website: partner.website || undefined,
              morada: partner.street || undefined,
              telefone: partner.phone || undefined,
              email: partner.email || undefined,
              nif: partner.vat || undefined,
              cidade: partner.city || undefined,
              codigoPostal: partner.zip || undefined,
              countryName: partner.country || undefined,
            }))
            .filter((match) => match.score >= 0.45)
            .sort((first, second) => second.score - first.score)
            .slice(0, 10);
        } catch (error) {
          odooUnavailable = true;
          console.warn("[EntityResearch] Odoo name search unavailable:", error);
        }
      }

      return res.json({
        fuzzyMatches: [...fuzzyMatches, ...odooMatches],
        googleResults: [],
        enrichmentSource:
          fuzzyMatches.length > 0 || odooMatches.length > 0 ? "fuzzy" : "none",
        settings,
        odooUnavailable,
      });
    } catch (error) {
      console.error("Error searching similar entities:", error);
      return res.status(500).json({ message: "Failed to search entities" });
    }
  },
);

router.post(
  "/api/enrichment/vat/validate",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const empresa = await storage.getEmpresa(empresaId);
      const settings = resolveEntityResearchSettings(empresa?.uiSettings);
      if (!settings.viesEnabled) {
        return res.status(403).json({ message: "A validação VIES está desativada." });
      }

      const countryCode = String(req.body?.countryCode ?? settings.defaultCountry).toUpperCase();
      const vatNumber = String(req.body?.vatNumber ?? "").trim();
      if (!/^[A-Z]{2}$/.test(countryCode) || !vatNumber) {
        return res.status(400).json({ message: "País ou identificação fiscal inválidos." });
      }

      return res.json(await validateVatWithVies({ countryCode, vatNumber }));
    } catch (error) {
      console.warn("[EntityResearch] VIES unavailable:", error);
      return res.status(503).json({
        message: "O VIES está temporariamente indisponível. Pode continuar manualmente.",
        unavailable: true,
      });
    }
  },
);

router.get(
  "/api/enrichment/postal-code/:postalCode",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const empresa = await storage.getEmpresa(empresaId);
      const settings = resolveEntityResearchSettings(empresa?.uiSettings);
      if (!settings.postalLookupEnabled) {
        return res.status(403).json({ message: "A pesquisa postal está desativada." });
      }

      return res.json(await lookupPortuguesePostalCode(req.params.postalCode));
    } catch (error: any) {
      if (error?.message === "INVALID_PORTUGUESE_POSTAL_CODE") {
        return res.status(400).json({ message: "Código postal inválido." });
      }
      if (error?.message === "POSTAL_CODE_NOT_FOUND") {
        return res.status(404).json({ message: "Código postal não encontrado." });
      }
      console.warn("[EntityResearch] Postal lookup unavailable:", error);
      return res.status(503).json({
        message: "A pesquisa postal está temporariamente indisponível.",
        unavailable: true,
      });
    }
  },
);

router.get(
  "/api/enrichment/address-search",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const empresa = await storage.getEmpresa(empresaId);
      const settings = resolveEntityResearchSettings(empresa?.uiSettings);
      if (!settings.postalLookupEnabled) {
        return res.status(403).json({ message: "A pesquisa de moradas está desativada." });
      }

      const query = String(req.query.q ?? "");
      const countryCode = String(req.query.countryCode ?? settings.defaultCountry);
      return res.json({ results: await searchAddress({ query, countryCode }) });
    } catch (error: any) {
      if (error?.message === "INVALID_ADDRESS_QUERY") {
        return res.status(400).json({ message: "Escreva uma morada mais completa." });
      }
      console.warn("[EntityResearch] Address lookup unavailable:", error);
      return res.status(503).json({
        message: "A pesquisa de moradas está temporariamente indisponível.",
        unavailable: true,
      });
    }
  },
);

router.post(
  "/api/enrichment/entity-ai",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);
      if (!empresaId) return res.status(400).json({ message: "User has no company assigned" });
      const empresa = await storage.getEmpresa(empresaId);
      const settings = resolveEntityResearchSettings(empresa?.uiSettings);
      const iaEnabled = (empresa?.uiSettings as any)?.ia?.aiEnabled !== false;
      if (!settings.aiFallbackEnabled || !iaEnabled) {
        return res.status(403).json({ message: "A pesquisa por IA está desativada." });
      }

      const name = String(req.body?.name ?? "").trim().slice(0, 255);
      const countryCode = String(req.body?.countryCode ?? settings.defaultCountry)
        .toUpperCase()
        .slice(0, 2);
      if (name.length < 3) return res.status(400).json({ message: "Nome demasiado curto." });

      const completion = await getOpenAIClient().chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content:
              "Return JSON only. Suggest public business details only when you are confident. Never invent tax IDs, emails, phone numbers or addresses. Use null for unknown values.",
          },
          {
            role: "user",
            content: `Company name: ${name}\nCountry code: ${countryCode}\nReturn: {"nome":string|null,"website":string|null,"morada":string|null,"cidade":string|null,"codigoPostal":string|null,"telefone":string|null,"email":string|null,"descricao":string|null,"confidence":number}`,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      const suggestion = content ? JSON.parse(content) : null;
      return res.json({
        suggestion,
        warning: "Dados sugeridos pela IA. Confirme antes de utilizar.",
        source: "ai",
      });
    } catch (error) {
      console.warn("[EntityResearch] AI lookup unavailable:", error);
      return res.status(503).json({
        message: "A pesquisa por IA está temporariamente indisponível.",
        unavailable: true,
      });
    }
  },
);

// ==========================================================
// GET /api/entidades
// ==========================================================
router.get(
  "/api/entidades",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const entidades = await storage.getEntidades(
        empresaId,
        userId,
        userRole,
      );

      res.json(entidades);
    } catch (error) {
      console.error("Error fetching entidades:", error);
      res.status(500).json({ message: "Failed to fetch entidades" });
    }
  },
);

// ==========================================================
// GET /api/entidades/:id
// ==========================================================
router.get(
  "/api/entidades/:id",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const { id } = req.params;

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const entidade = await storage.getEntidade(
        id,
        empresaId,
        userId,
        userRole,
      );

      if (!entidade) {
        return res.status(404).json({ message: "Entidade not found" });
      }

      res.json(entidade);
    } catch (error) {
      console.error("Error fetching entidade:", error);
      res.status(500).json({ message: "Failed to fetch entidade" });
    }
  },
);

// ==========================================================
// POST /api/entidades
// ==========================================================
router.post(
  "/api/entidades",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      await assertTenantReferences(empresaId, {
        entidadeTipoId: req.body.entidadeTipoId,
        assignedUserId: req.body.assignedUserId,
      });
      const { selectedOdooPartnerId, validatedVatStatus, ...submittedData } = req.body;
      let linkedOdooPartnerId: string | undefined;
      if (selectedOdooPartnerId !== undefined && selectedOdooPartnerId !== null) {
        const partnerId = Number(selectedOdooPartnerId);
        if (!Number.isInteger(partnerId) || partnerId <= 0) {
          return res.status(400).json({ message: "Parceiro Odoo inválido." });
        }
        const partner = await getOdooPartnerById(empresaId, partnerId);
        if (!partner) return res.status(400).json({ message: "Parceiro Odoo não encontrado." });
        linkedOdooPartnerId = String(partner.id);
      }
      const entidadeData = {
        ...submittedData,
        empresaId: undefined,
        createdByUserId: userId,
        ...(linkedOdooPartnerId ? { odooPartnerId: linkedOdooPartnerId } : {}),
        ...(validatedVatStatus === "valid" || validatedVatStatus === "invalid"
          ? {
              vatValidationStatus: validatedVatStatus,
              vatValidatedAt: new Date(),
            }
          : {}),
      };

      const newEntidade = await storage.createEntidade(entidadeData, empresaId);

      res.json(newEntidade);
    } catch (error) {
      console.error("Error creating entidade:", error);
      res.status(400).json({ message: "Failed to create entidade" });
    }
  },
);

// ==========================================================
// PATCH /api/entidades/:id
// ==========================================================
router.patch(
  "/api/entidades/:id",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);
      const { id } = req.params;

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      await assertTenantReferences(empresaId, {
        entidadeTipoId: req.body.entidadeTipoId,
        assignedUserId: req.body.assignedUserId,
      });
      const existingEntidade = await storage.getEntidade(
        id,
        empresaId,
        userId,
        userRole,
      );
      if (!existingEntidade) {
        return res.status(404).json({ message: "Entidade not found or unauthorized" });
      }
      const { selectedOdooPartnerId, validatedVatStatus, ...submittedUpdates } = req.body;
      const updates = { ...submittedUpdates } as any;
      delete updates.id;
      delete updates.empresaId;
      delete updates.createdByUserId;
      if (selectedOdooPartnerId !== undefined && selectedOdooPartnerId !== null) {
        const partnerId = Number(selectedOdooPartnerId);
        if (!Number.isInteger(partnerId) || partnerId <= 0) {
          return res.status(400).json({ message: "Parceiro Odoo inválido." });
        }
        const partner = await getOdooPartnerById(empresaId, partnerId);
        if (!partner) return res.status(400).json({ message: "Parceiro Odoo não encontrado." });
        updates.odooPartnerId = String(partner.id);
      }
      const taxIdentityChanged =
        (submittedUpdates.nif !== undefined && submittedUpdates.nif !== existingEntidade.nif) ||
        (submittedUpdates.countryCode !== undefined &&
          submittedUpdates.countryCode !== existingEntidade.countryCode);
      if (
        (validatedVatStatus === "valid" || validatedVatStatus === "invalid") &&
        (taxIdentityChanged || validatedVatStatus !== existingEntidade.vatValidationStatus)
      ) {
        updates.vatValidationStatus = validatedVatStatus;
        updates.vatValidatedAt = new Date();
      } else if (taxIdentityChanged && validatedVatStatus == null) {
        updates.vatValidationStatus = null;
        updates.vatValidatedAt = null;
      }

      const updated = await storage.updateEntidade(
        id,
        updates,
        empresaId,
        userId,
        userRole,
      );

      if (!updated) {
        return res
          .status(404)
          .json({ message: "Entidade not found or unauthorized" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating entidade:", error);
      res.status(400).json({ message: "Failed to update entidade" });
    }
  },
);

// ==========================================================
// DELETE /api/entidades/:id
// ==========================================================
router.delete(
  "/api/entidades/:id",
  isAuthenticated,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);
      const { id } = req.params;

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      await storage.deleteEntidade(id, empresaId);

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting entidade:", error);
      res.status(500).json({ message: "Failed to delete entidade" });
    }
  },
);

// ==========================================================
// GET /api/entidade-tipos (Ativos)
// ==========================================================
router.get(
  "/api/entidade-tipos",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const tipos = await storage.getEntidadeTiposAtivos(empresaId);

      res.json(tipos);
    } catch (error) {
      console.error("Error fetching entidade tipos:", error);
      res.status(500).json({ message: "Failed to fetch entidade tipos" });
    }
  },
);

// ==========================================================
// GET /api/crm/entidades/search
// (usado pelos componentes SearchSelects no frontend)
// ==========================================================
router.get(
  "/api/crm/entidades/search",
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { empresaId, userId, userRole } = await getUserContext(req);

      if (!empresaId) {
        return res
          .status(400)
          .json({ message: "User has no company assigned" });
      }

      const q = ((req.query.q as string) || "").toLowerCase();

      const entidades = await storage.getEntidades(
        empresaId,
        userId,
        userRole,
      );

      const results = (entidades || [])
        .filter((e: any) => (e.nome || "").toLowerCase().includes(q))
        .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""))
        .slice(0, 20)
        .map((e: any) => ({
          id: e.id,
          label: e.nome,
          extraInfo: e.cidade || e.nif || undefined,
          data: {
            cidade: e.cidade,
            nif: e.nif,
          },
        }));

      res.json(results);
    } catch (error) {
      console.error("Error searching entidades:", error);
      res.status(500).json({ message: "Failed to search entidades" });
    }
  },
);


// ==========================================================
// Export para o agregador de rotas
// ==========================================================

// Compatível com o padrão antigo: registerEntidadesRoutes(app)
export function registerEntidadesRoutes(app: express.Express) {
  app.use(router);
}

// Default export do router (se em algum lado estiverem a fazer app.use(entidadesRoutes))
export default router;

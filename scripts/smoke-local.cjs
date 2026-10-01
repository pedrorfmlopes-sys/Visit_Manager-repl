const { spawn } = require("child_process");
const http = require("http");

const base = "http://127.0.0.1:5050";
let cookie = "";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const payload = body ? Buffer.from(JSON.stringify(body)) : null;

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": payload.length,
              }
            : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        let chunks = "";
        if (res.headers["set-cookie"]) {
          cookie = res.headers["set-cookie"]
            .map((value) => value.split(";")[0])
            .join("; ");
        }
        res.on("data", (data) => {
          chunks += data;
        });
        res.on("end", () => {
          let parsed = chunks;
          try {
            parsed = JSON.parse(chunks);
          } catch {}
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        });
      },
    );

    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function waitForServer(maxAttempts = 30) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await request("GET", "/api/auth/me");
      if ([200, 401].includes(response.status)) {
        return;
      }
    } catch {}
    await wait(1000);
  }

  throw new Error("Server did not become ready in time");
}

function expectStatus(label, response, allowed) {
  const accepted = Array.isArray(allowed) ? allowed : [allowed];
  if (!accepted.includes(response.status)) {
    throw new Error(`${label} failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }
}

async function runSmoke() {
  const login = await request("GET", "/api/login");
  expectStatus("login", login, [200, 302]);

  const me = await request("GET", "/api/auth/me");
  expectStatus("auth/me", me, 200);
  console.log("AUTH", me.body.email, me.body.role, me.body.empresaId);

  const adminEmpresa = await request("GET", "/api/admin/empresa");
  expectStatus("admin empresa", adminEmpresa, 200);
  console.log("ADMIN_EMPRESA", adminEmpresa.body.id, adminEmpresa.body.nome);

  const adminUsers = await request("GET", "/api/admin/utilizadores");
  expectStatus("admin utilizadores", adminUsers, 200);
  console.log("ADMIN_USERS", Array.isArray(adminUsers.body) ? adminUsers.body.length : -1);

  const existingTipos = await request("GET", "/api/admin/entidade-tipos");
  expectStatus("admin entidade tipos", existingTipos, 200);
  console.log("ADMIN_TIPOS", Array.isArray(existingTipos.body) ? existingTipos.body.length : -1);

  const tipo = await request("POST", "/api/admin/entidade-tipos", {
    nome: "ZZ Tipo API",
    cor: "#3b82f6",
    icon: "Building2",
    ativo: true,
    ordem: 0,
  });
  expectStatus("create entidade tipo", tipo, 200);
  const tipoId = tipo.body.id;
  console.log("TIPO", tipoId);

  const entidade = await request("POST", "/api/entidades", {
    nome: "ZZ Teste API",
    tipoEntidade: "Gabinete",
    entidadeTipoId: tipoId,
  });
  expectStatus("create entidade", entidade, 200);
  const entidadeId = entidade.body.id;
  console.log("ENTIDADE", entidadeId);

  const contacto = await request("POST", "/api/contactos", {
    nome: "ZZ Contacto API",
    entidadeId,
    email: "zz-api@example.com",
  });
  expectStatus("create contacto", contacto, 200);
  const contactoId = contacto.body.id;
  console.log("CONTACTO", contactoId);

  const visita = await request("POST", "/api/visitas", {
    entidadeId,
    contactoId,
    dataVisita: new Date().toISOString(),
    notas: "teste api",
    contactosIds: [contactoId],
    marcasIds: [],
  });
  expectStatus("create visita", visita, 200);
  const visitaId = visita.body.id;
  console.log("VISITA", visitaId);

  const tarefa = await request("POST", "/api/tarefas", {
    titulo: "ZZ Tarefa API",
    entidadeId,
    visitaId,
    status: "pending",
    repeatInterval: "none",
  });
  expectStatus("create tarefa", tarefa, 200);
  const tarefaId = tarefa.body.id;
  console.log("TAREFA", tarefaId);

  const visitaPatch = await request("PATCH", `/api/visitas/${visitaId}`, {
    notas: "teste api atualizado",
    contactosIds: [],
    marcasIds: [],
  });
  expectStatus("patch visita", visitaPatch, 200);

  const visitaGet = await request("GET", `/api/visitas/${visitaId}`);
  expectStatus("get visita", visitaGet, 200);
  const contactosPresentes = Array.isArray(visitaGet.body.contactosPresentes)
    ? visitaGet.body.contactosPresentes.length
    : 0;
  console.log("VISITA_CONTACTOS_PRESENTES", contactosPresentes);

  if (process.env.OPENAI_API_KEY) {
    const aiSummary = await request("POST", "/api/ai/visit-summary", {
      visitaId,
    });
    expectStatus("ai visit summary", aiSummary, 200);
    console.log(
      "AI_VISIT_SUMMARY",
      typeof aiSummary.body?.resumo === "string" && aiSummary.body.resumo.length > 0,
    );

    const aiDashboard = await request("POST", "/api/ai/dashboard-insights", {
      scope: "agent",
      metrics: {
        visitasRealizadas: 1,
        visitasAgendadas: 0,
        tarefasCriadas: 1,
        tarefasConcluidas: 0,
        tarefasEmAtraso: 0,
        clientesChave: [{ nome: "ZZ Teste API", visitCount: 1 }],
        marcasMaisTrabalhadas: [],
      },
    });
    expectStatus("ai dashboard insights", aiDashboard, 200);
    console.log(
      "AI_DASHBOARD_INSIGHTS",
      typeof aiDashboard.body?.insights === "string" &&
        aiDashboard.body.insights.length > 0,
    );
  }

  if (
    process.env.ODOO_URL &&
    process.env.ODOO_DB &&
    process.env.ODOO_USER &&
    process.env.ODOO_PASS
  ) {
    const odooStatus = await request("GET", "/api/integrations/odoo/status");
    expectStatus("odoo status", odooStatus, 200);
    console.log("ODOO_STATUS", Boolean(odooStatus.body?.configured));

    const odooSearch = await request(
      "GET",
      "/api/integrations/odoo/search-partner?q=test",
    );
    expectStatus("odoo search partner", odooSearch, 200);
    console.log(
      "ODOO_SEARCH_OK",
      Array.isArray(odooSearch.body?.results) || Boolean(odooSearch.body?.notConfigured),
    );

    const partner = Array.isArray(odooSearch.body?.results)
      ? odooSearch.body.results[0]
      : null;

    if (partner?.id) {
      const importEntity = await request(
        "POST",
        `/api/integrations/odoo/sync/partners/${partner.id}/import-entity`,
        {},
      );
      expectStatus("odoo import entity", importEntity, 200);
      console.log("ODOO_IMPORT_ENTITY", Boolean(importEntity.body?.success));

      const importedEntityId = importEntity.body?.entidade?.id;

      const importContact = await request(
        "POST",
        `/api/integrations/odoo/sync/partners/${partner.id}/import-contact`,
        { entidadeId: importedEntityId },
      );
      expectStatus("odoo import contact", importContact, 200);
      console.log("ODOO_IMPORT_CONTACT", Boolean(importContact.body?.success));

      const importedContactId = importContact.body?.contacto?.id;

      if (importedContactId) {
        await request("DELETE", `/api/contactos/${importedContactId}`);
      }

      if (importedEntityId) {
        await request("DELETE", `/api/entidades/${importedEntityId}`);
      }
    }
  }

  const delTarefa = await request("DELETE", `/api/tarefas/${tarefaId}`);
  expectStatus("delete tarefa", delTarefa, 200);

  const delContacto = await request("DELETE", `/api/contactos/${contactoId}`);
  expectStatus("delete contacto", delContacto, 200);

  const delEntidade = await request("DELETE", `/api/entidades/${entidadeId}`);
  expectStatus("delete entidade", delEntidade, 200);

  const delTipo = await request("PATCH", `/api/admin/entidade-tipos/${tipoId}`, {
    ativo: false,
  });
  expectStatus("disable entidade tipo", delTipo, 200);

  console.log("SMOKE_OK");
}

async function main() {
  let child = null;
  try {
    try {
      await waitForServer(2);
    } catch {
      if (process.env.START_SERVER === "1") {
        child = spawn("cmd.exe", ["/c", "npm run dev:local"], {
          stdio: "inherit",
          cwd: process.cwd(),
        });
        await waitForServer();
      } else {
        throw new Error("Server is not running");
      }
    }

    if (!child && process.env.START_SERVER !== "1") {
      await waitForServer(3);
    }

    await runSmoke();
  } finally {
    if (child) {
      child.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error("SMOKE_FAIL", error.message);
  process.exit(1);
});

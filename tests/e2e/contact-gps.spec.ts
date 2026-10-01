import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { db } from "../../server/db";
import { uploadsDir } from "../../server/uploads";
import {
  contactos,
  empresas,
  entidades,
  visitas,
  visitasAudio,
} from "../../shared/schema";

async function login(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/api/login");
  await page.waitForURL(/\/$/);
}

test("admin scans and merges duplicate contacts through the UI", async ({ page }) => {
  await login(page);
  const me = await (await page.context().request.get("/api/auth/me")).json();
  const suffix = Date.now().toString();
  const [first, second] = await db
    .insert(contactos)
    .values([
      {
        empresaId: me.empresaId,
        nome: `Duplicado principal ${suffix}`,
        email: `duplicate-${suffix}@example.test`,
        createdByUserId: me.id,
      },
      {
        empresaId: me.empresaId,
        nome: `Duplicado secundário ${suffix}`,
        email: `DUPLICATE-${suffix}@example.test`,
        telemovel: `+351 93${suffix.slice(-7)}`,
        createdByUserId: me.id,
      },
    ])
    .returning();

  try {
    await page.goto("/contactos");
    await page.getByTestId("button-scan-duplicate-contacts").click();
    await expect(page.getByText("Verificar contactos duplicados")).toBeVisible();
    const dialog = page.getByRole("dialog", {
      name: "Verificar contactos duplicados",
    });
    await expect(dialog.getByText(first.nome, { exact: true })).toBeVisible();
    await expect(dialog.getByText(second.nome, { exact: true })).toBeVisible();
    const group = dialog.locator("section").filter({ hasText: first.nome });
    await group
      .locator("label")
      .filter({ hasText: first.nome })
      .locator('input[type="radio"]')
      .check();
    const mergeResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/contactos-merge") &&
        response.request().method() === "POST",
    );
    await group
      .getByRole("button", { name: "Unir e manter o contacto selecionado" })
      .click();
    expect((await mergeResponsePromise).ok()).toBeTruthy();
    await expect(group).not.toBeVisible();

    const remaining = await db
      .select()
      .from(contactos)
      .where(eq(contactos.id, first.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].telemovel).toBe(`+351 93${suffix.slice(-7)}`);
  } finally {
    await db
      .delete(contactos)
      .where(inArray(contactos.id, [first.id, second.id]));
  }
});

test("contact search opens immediately, filters names and contact can be deleted", async ({
  page,
}) => {
  await login(page);
  const me = await (await page.context().request.get("/api/auth/me")).json();
  const suffix = Date.now().toString();
  const [contact] = await db
    .insert(contactos)
    .values({
      empresaId: me.empresaId,
      nome: `Pesquisa Remoção ${suffix}`,
      email: `search-delete-${suffix}@example.test`,
      telemovel: `+351 96${suffix.slice(-7)}`,
      createdByUserId: me.id,
    })
    .returning();

  try {
    await page.goto("/contactos");
    const search = page.getByTestId("input-search");
    await search.focus();
    const results = page.getByTestId("contact-search-results");
    await expect(results).toBeVisible();
    await expect(results.locator("button")).not.toHaveCount(0);

    await search.fill(contact.nome);
    const result = page.getByTestId(`contact-search-result-${contact.id}`);
    await expect(result).toBeVisible();
    await expect(result).toContainText(contact.email!);
    await result.click();
    await expect(page).toHaveURL(new RegExp(`/contactos/${contact.id}/detalhes$`));

    const deleteButton = page.getByTestId("button-deletar");
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await expect(page.getByText("Eliminar este contacto?")).toBeVisible();
    await page.getByTestId("confirm-delete-contact").click();
    await expect(page).toHaveURL(/\/contactos$/);
    expect(
      await db.select().from(contactos).where(eq(contactos.id, contact.id)),
    ).toHaveLength(0);
  } finally {
    await db.delete(contactos).where(eq(contactos.id, contact.id));
  }
});

test("entity search opens immediately, filters names and navigates", async ({
  page,
}) => {
  await login(page);
  const me = await (await page.context().request.get("/api/auth/me")).json();
  const suffix = Date.now().toString();
  const [entity] = await db
    .insert(entidades)
    .values({
      empresaId: me.empresaId,
      nome: `Entidade Pesquisa ${suffix}`,
      cidade: "Lisboa",
      email: `entity-search-${suffix}@example.test`,
      nif: suffix.slice(-9),
      createdByUserId: me.id,
      assignedUserId: me.id,
    })
    .returning();

  try {
    const similarResponse = await page.context().request.post(
      "/api/enrichment/pt-intelligent-search",
      { data: { nome: `Entidade Pesquisa ${suffix}` } },
    );
    expect(similarResponse.ok()).toBeTruthy();
    const similarPayload = await similarResponse.json();
    expect(
      similarPayload.fuzzyMatches.some(
        (match: { id: string }) => match.id === entity.id,
      ),
    ).toBeTruthy();

    await page.goto("/entidades");
    const search = page.getByTestId("input-search");
    await search.focus();

    const results = page.getByTestId("entity-search-results");
    await expect(results).toBeVisible();
    await expect(results.locator("button")).not.toHaveCount(0);

    await search.fill(entity.nome);
    const result = page.getByTestId(`entity-search-result-${entity.id}`);
    await expect(result).toBeVisible();
    await expect(result).toContainText(entity.email!);
    await expect(result).toContainText("Lisboa");
    await result.click();

    await expect(page).toHaveURL(new RegExp(`/entidades/${entity.id}$`));
  } finally {
    await db.delete(entidades).where(eq(entidades.id, entity.id));
  }
});

test("blocked offline changes can be inspected, retried and discarded", async ({
  page,
}) => {
  await login(page);

  const pendingItemId = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("VisitasDB", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return new Promise<number>((resolve, reject) => {
      const transaction = database.transaction("pendingSync", "readwrite");
      const request = transaction.objectStore("pendingSync").add({
        type: "tarefa",
        action: "create",
        data: { titulo: "Alteração offline bloqueada" },
        endpoint: "/api/test/offline-sync-failure",
        timestamp: Date.now(),
        retryCount: 5,
      });
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  });

  try {
    await page.reload();
    await expect(page.getByTestId("badge-pending")).toContainText("1 pendente");
    await page.getByTestId("button-sync-details").click();

    const pendingItem = page.getByTestId(`pending-sync-item-${pendingItemId}`);
    await expect(pendingItem).toBeVisible();
    await expect(pendingItem).toContainText("Bloqueada");
    await expect(pendingItem).toContainText("Tentativas falhadas: 5");

    const failedRequest = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/test/offline-sync-failure") &&
        response.request().method() === "POST",
    );
    await page.getByTestId(`retry-pending-sync-${pendingItemId}`).click();
    expect((await failedRequest).status()).toBe(404);
    await expect(pendingItem).toContainText("Tentativas falhadas: 1");

    await page.getByTestId(`discard-pending-sync-${pendingItemId}`).click();
    await expect(pendingItem).toHaveCount(0);
    await expect(page.getByTestId("badge-synced")).toBeVisible();
    await expect(page.getByTestId("pending-sync-list")).toHaveCount(0);
  } finally {
    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("VisitasDB", 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("pendingSync", "readwrite");
        const request = transaction.objectStore("pendingSync").clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }
});

test("uploads are private per company and deleted with their visit", async ({
  page,
  request,
}) => {
  await login(page);
  const me = await (await page.context().request.get("/api/auth/me")).json();
  const suffix = Date.now().toString();
  const ownLogoFilename = `e2e-own-logo-${suffix}`;
  const foreignFilename = `e2e-foreign-logo-${suffix}`;
  const audioFilename = `e2e-visit-audio-${suffix}`;
  const mediaFilename = `e2e-visit-media-${suffix}`;
  const recordFilename = `e2e-record-audio-${suffix}`;
  const allFilenames = [
    ownLogoFilename,
    foreignFilename,
    audioFilename,
    mediaFilename,
    recordFilename,
  ];
  const [foreignCompany] = await db
    .insert(empresas)
    .values({
      nome: `Empresa Upload Estrangeira ${suffix}`,
      logoUrl: `/uploads/${foreignFilename}`,
    })
    .returning();
  const [entity] = await db
    .insert(entidades)
    .values({
      empresaId: me.empresaId,
      nome: `Entidade Upload ${suffix}`,
      logoUrl: `/uploads/${ownLogoFilename}`,
      createdByUserId: me.id,
      assignedUserId: me.id,
    })
    .returning();
  const [visit] = await db
    .insert(visitas)
    .values({
      empresaId: me.empresaId,
      entidadeId: entity.id,
      userId: me.id,
      dataVisita: new Date(),
      audioUrl: `/uploads/${audioFilename}`,
      mediaUrls: [`/uploads/${mediaFilename}`],
    })
    .returning();
  await db.insert(visitasAudio).values({
    empresaId: me.empresaId,
    visitaId: visit.id,
    fileUrl: `/uploads/${recordFilename}`,
  });

  await Promise.all(
    allFilenames.map((filename) =>
      fs.writeFile(path.join(uploadsDir, filename), `upload-${filename}`),
    ),
  );

  try {
    const filesBeforeRejectedUpload = (await fs.readdir(uploadsDir)).sort();
    const rejectedUpload = await page.context().request.post(
      "/api/admin/empresa/logo",
      {
        multipart: {
          file: {
            name: "disguised.png",
            mimeType: "image/png",
            buffer: Buffer.from("this is not a real png"),
          },
        },
      },
    );
    expect(rejectedUpload.status()).toBe(400);
    expect((await fs.readdir(uploadsDir)).sort()).toEqual(
      filesBeforeRejectedUpload,
    );

    const ownResponse = await page.context().request.get(
      `/uploads/${ownLogoFilename}`,
    );
    expect(ownResponse.status()).toBe(200);
    expect(await ownResponse.text()).toBe(`upload-${ownLogoFilename}`);
    expect(ownResponse.headers()["x-content-type-options"]).toBe("nosniff");
    expect(ownResponse.headers()["content-security-policy"]).toContain(
      "sandbox",
    );

    const apiAliasResponse = await page.context().request.get(
      `/api/uploads/${audioFilename}`,
    );
    expect(apiAliasResponse.status()).toBe(200);

    const foreignResponse = await page.context().request.get(
      `/uploads/${foreignFilename}`,
    );
    expect(foreignResponse.status()).toBe(404);

    const anonymousResponse = await request.get(`/uploads/${ownLogoFilename}`);
    expect(anonymousResponse.status()).toBe(401);

    const deleteResponse = await page.context().request.delete(
      `/api/visitas/${visit.id}`,
    );
    expect(deleteResponse.ok()).toBeTruthy();

    for (const filename of [audioFilename, mediaFilename, recordFilename]) {
      await expect(
        fs.access(path.join(uploadsDir, filename)),
      ).rejects.toThrow();
    }
  } finally {
    await db.delete(entidades).where(eq(entidades.id, entity.id));
    await db.delete(empresas).where(eq(empresas.id, foreignCompany.id));
    await Promise.all(
      allFilenames.map((filename) =>
        fs.unlink(path.join(uploadsDir, filename)).catch(() => undefined),
      ),
    );
  }
});

test("visit detail exposes a working map action for saved coordinates", async ({
  page,
}) => {
  await login(page);
  const me = await (await page.context().request.get("/api/auth/me")).json();
  const [entity] = await db
    .insert(entidades)
    .values({
      empresaId: me.empresaId,
      nome: `Mapa E2E ${Date.now()}`,
      latitude: "38.7223",
      longitude: "-9.1393",
      createdByUserId: me.id,
      assignedUserId: me.id,
    })
    .returning();
  const [visit] = await db
    .insert(visitas)
    .values({
      empresaId: me.empresaId,
      entidadeId: entity.id,
      userId: me.id,
      dataVisita: new Date(),
      latitude: "38.7223",
      longitude: "-9.1393",
      locationAccuracy: "15",
    })
    .returning();

  try {
    await page.goto(`/visitas/${visit.id}`);
    const mapButton = page.getByTestId("button-view-map");
    await expect(mapButton).toBeVisible({ timeout: 15_000 });
    const popupPromise = page.waitForEvent("popup");
    await mapButton.click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/openstreetmap\.org.*38\.7223.*-9\.1393/);
    await popup.close();
  } finally {
    await db.delete(entidades).where(eq(entidades.id, entity.id));
  }
});

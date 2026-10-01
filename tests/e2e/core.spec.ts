import { expect, test } from "@playwright/test";
import { addDays, startOfWeek } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../server/db";
import {
  deleteOdooPartnerById,
  deleteOdooLeadById,
  getOdooPartnerById,
  getOdooLeadById,
  updateOdooLeadTitle,
  updateOdooLeadType,
} from "../../server/integrations/odooClient";
import {
  contactos,
  empresas,
  externalIdentities,
  leadApprovalRequests,
  leadFollowers,
  leads,
  passwordResetTokens,
  users,
} from "../../shared/schema";
import { hashPassword } from "../../server/passwordAuth";

async function login(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/api/login");
  await page.waitForURL(/\/$/);
}

async function cleanupByName(
  page: Parameters<typeof test>[0]["page"],
  path: string,
  name: string,
) {
  const response = await page.context().request.get(path);
  const payload = await response.json();
  const items = Array.isArray(payload) ? payload : [];
  const match = items.find((item: any) => item?.nome === name || item?.titulo === name);
  return match?.id;
}

test.describe("core navigation", () => {
  test("desktop uses contextual creation actions without a floating menu", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);

    await expect(page.getByTestId("fab-open")).toHaveCount(0);

    await page.goto("/admin/leads");
    await expect(page.getByTestId("button-new-lead")).toBeVisible({ timeout: 15_000 });

    await page.goto("/visitas");
    await expect(page.getByTestId("button-create-visita-header")).toBeVisible({ timeout: 15_000 });

    await page.goto("/tarefas");
    await expect(page.getByTestId("button-create-tarefa-header")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("fab-open")).toHaveCount(0);
  });

  test("navigation adapts cleanly to mobile, tablet and desktop", async ({
    page,
  }) => {
    test.setTimeout(90_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await expect(
      page.getByRole("heading", { name: /Dashboard/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    const mobileNav = page.getByTestId("mobile-bottom-nav");
    await expect(mobileNav).toBeVisible();
    await expect(page.getByTestId("mobile-topbar-profile")).toBeVisible();
    await expect(page.getByTestId("tablet-nav-rail")).toBeHidden();
    await expect(page.getByTestId("desktop-sidebar")).toBeHidden();
    await expect(page.getByTestId("fab-open")).toHaveCount(0);

    const mobileNavBox = await mobileNav.boundingBox();
    expect(mobileNavBox).toBeTruthy();
    expect(mobileNavBox!.x).toBeGreaterThanOrEqual(0);
    expect(mobileNavBox!.x + mobileNavBox!.width).toBeLessThanOrEqual(390);
    expect(mobileNavBox!.y + mobileNavBox!.height).toBeLessThanOrEqual(844);
    const mobileContentBox = await page
      .getByTestId("app-content-shell")
      .boundingBox();
    expect(mobileContentBox).toBeTruthy();
    expect(mobileContentBox!.x).toBe(0);

    await page.getByTestId("mobile-nav-create").click();
    await expect(page.getByText("O que pretende criar?")).toBeVisible();
    for (const testId of [
      "mobile-create-entidade",
      "mobile-create-contacto",
      "mobile-create-visita",
      "mobile-create-tarefa",
    ]) {
      await expect(page.getByTestId(testId)).toBeVisible();
    }
    await page.getByTestId("mobile-create-visita").click();
    await expect(page).toHaveURL(/\/visitas\/nova$/);
    const createVisitButton = page.getByRole("button", {
      name: /Criar Visita$/i,
    });
    await expect(createVisitButton).toBeVisible();
    const createVisitBox = await createVisitButton.boundingBox();
    const currentMobileNavBox = await mobileNav.boundingBox();
    expect(createVisitBox).toBeTruthy();
    expect(currentMobileNavBox).toBeTruthy();
    expect(createVisitBox!.y + createVisitBox!.height).toBeLessThanOrEqual(
      currentMobileNavBox!.y,
    );
    await page.goto("/");
    await expect(mobileNav).toBeVisible();

    await page.getByTestId("mobile-nav-more").click();
    await expect(page.getByText("Mais opções")).toBeVisible();
    await expect(page.getByTestId("mobile-more-contactos")).toBeVisible();
    await expect(page.getByTestId("mobile-more-planeamento")).toBeVisible();
    await expect(page.getByTestId("mobile-more-tarefas")).toBeVisible();
    await expect(page.getByTestId("mobile-more-lembretes")).toBeVisible();
    await expect(page.getByTestId("mobile-more-perfil")).toBeVisible();
    await expect(page.getByTestId("mobile-more-settings")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Mais opções")).toBeHidden();

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId("tablet-nav-rail")).toBeVisible();
    await expect(mobileNav).toBeHidden();
    await expect(page.getByTestId("desktop-sidebar")).toBeHidden();
    await expect(page.getByTestId("fab-open")).toHaveCount(0);
    await expect(page.getByTestId("tablet-nav-entidades")).toBeVisible();
    await expect(page.getByTestId("tablet-nav-visitas")).toBeVisible();
    await expect(page.getByTestId("tablet-nav-tarefas")).toBeVisible();
    await expect(page.getByTestId("tablet-nav-plano")).toBeVisible();

    const tabletRailBox = await page.getByTestId("tablet-nav-rail").boundingBox();
    expect(tabletRailBox).toBeTruthy();
    expect(tabletRailBox!.width).toBe(96);
    expect(tabletRailBox!.height).toBe(768);
    const tabletContentBox = await page
      .getByTestId("app-content-shell")
      .boundingBox();
    expect(tabletContentBox).toBeTruthy();
    expect(tabletContentBox!.x).toBe(96);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId("desktop-sidebar")).toBeVisible();
    await expect(page.getByTestId("tablet-nav-rail")).toBeHidden();
    await expect(mobileNav).toBeHidden();
    await expect(page.getByTestId("fab-open")).toHaveCount(0);
    const desktopContentBox = await page
      .getByTestId("app-content-shell")
      .boundingBox();
    expect(desktopContentBox).toBeTruthy();
    expect(desktopContentBox!.x).toBe(256);
  });

  test("admin plans an unplanned task in the weekly planner", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);
    const meResponse = await page.context().request.get("/api/auth/me");
    expect(meResponse.ok()).toBeTruthy();
    const me = await meResponse.json();
    const title = `Planeamento E2E ${Date.now()}`;
    const contextualTitle = `Planeamento contextual ${Date.now()}`;
    const scheduled = addDays(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      1,
    );
    scheduled.setHours(10, 30, 0, 0);
    const targetDayKey = [
      scheduled.getFullYear(),
      String(scheduled.getMonth() + 1).padStart(2, "0"),
      String(scheduled.getDate()).padStart(2, "0"),
    ].join("-");
    const followingDay = new Date(scheduled);
    followingDay.setDate(followingDay.getDate() + 1);
    const followingDayKey = [
      followingDay.getFullYear(),
      String(followingDay.getMonth() + 1).padStart(2, "0"),
      String(followingDay.getDate()).padStart(2, "0"),
    ].join("-");
    const createResponse = await page.context().request.post("/api/tarefas", {
      data: {
        titulo: title,
        assignedUserId: me.id,
        status: "pending",
      },
    });
    expect(createResponse.ok()).toBeTruthy();
    const task = await createResponse.json();
    const planningEntityResponse = await page.context().request.post("/api/entidades", {
      data: { nome: `Planeamento visita ${Date.now()}` },
    });
    expect(planningEntityResponse.ok()).toBeTruthy();
    const planningEntity = await planningEntityResponse.json();
    const planningVisitResponse = await page.context().request.post("/api/visitas", {
      multipart: {
        entidadeId: planningEntity.id,
        dataVisita: scheduled.toISOString(),
        notas: "Visita temporária para validar o regresso ao planeamento.",
        contactosIds: "[]",
        marcasIds: "[]",
      },
    });
    expect(planningVisitResponse.ok()).toBeTruthy();
    const planningVisit = await planningVisitResponse.json();
    const overflowTasks = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const response = await page.context().request.post("/api/tarefas", {
          data: {
            titulo: `Planeamento coluna ${Date.now()} ${index}`,
            assignedUserId: me.id,
            status: "done",
            dueDate: new Date(
              scheduled.getFullYear(),
              scheduled.getMonth(),
              scheduled.getDate(),
              8,
              index * 5,
            ).toISOString(),
          },
        });
        expect(response.ok()).toBeTruthy();
        return response.json();
      }),
    );
    let contextualTaskId: string | null = null;

    try {
      await page.goto("/planeamento");
      await expect(
        page.getByRole("heading", { name: "Organizar a semana" }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("planning-user-filter")).toBeVisible();

      await page.setViewportSize({ width: 390, height: 844 });
      const mobileWeekGrid = page.getByTestId("planning-week-grid");
      await expect(mobileWeekGrid).toBeVisible();
      await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
      const mobileGridMetrics = await mobileWeekGrid.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(mobileGridMetrics.scrollWidth).toBeGreaterThan(
        mobileGridMetrics.clientWidth,
      );
      expect(mobileGridMetrics.bodyWidth).toBeLessThanOrEqual(
        mobileGridMetrics.viewportWidth,
      );

      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(page.getByTestId("tablet-nav-rail")).toBeVisible();
      const tabletGridMetrics = await mobileWeekGrid.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(tabletGridMetrics.scrollWidth).toBeLessThanOrEqual(
        tabletGridMetrics.clientWidth + 1,
      );

      await page.setViewportSize({ width: 1280, height: 800 });

      await page.getByTestId("planning-view-day").click();
      await expect(
        page.getByRole("heading", { name: "Organizar o dia" }),
      ).toBeVisible();
      await expect(mobileWeekGrid).toHaveAttribute("data-view", "day");
      await expect(
        mobileWeekGrid.locator(':scope > [data-testid^="planning-day-"]'),
      ).toHaveCount(1);

      await page.getByTestId("planning-view-month").click();
      await expect(
        page.getByRole("heading", { name: "Organizar o mês" }),
      ).toBeVisible();
      await expect(mobileWeekGrid).toHaveAttribute("data-view", "month");
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await mobileWeekGrid
          .locator(':scope > [data-testid^="planning-day-"]')
          .count(),
      ).toBeGreaterThanOrEqual(35);
      const monthlyBodyWidth = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(monthlyBodyWidth.body).toBeLessThanOrEqual(
        monthlyBodyWidth.viewport,
      );

      await page.getByTestId("planning-view-week").click();
      await expect(
        page.getByRole("heading", { name: "Organizar a semana" }),
      ).toBeVisible();
      await expect(mobileWeekGrid).toHaveAttribute("data-view", "week");
      await page.setViewportSize({ width: 1280, height: 800 });

      const planningItem = page.getByTestId(`planning-item-tarefa-${task.id}`);
      await expect(planningItem).toBeVisible();
      await expect(
        page.getByTestId("planning-conflict-summary"),
      ).toBeVisible();

      const targetDay = page.getByTestId(`planning-day-${targetDayKey}`);
      const targetDayScroll = page.getByTestId(
        `planning-day-scroll-${targetDayKey}`,
      );
      await expect(targetDay).toBeVisible();
      const columnMetrics = await targetDayScroll.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflowY: getComputedStyle(element).overflowY,
      }));
      expect(columnMetrics.overflowY).toBe("auto");
      expect(columnMetrics.scrollHeight).toBeGreaterThan(
        columnMetrics.clientHeight,
      );

      const draggedTask = overflowTasks[0];
      const followingDayColumn = page.getByTestId(
        `planning-day-${followingDayKey}`,
      );
      const dragGeometry = await page.evaluate(
        ({ dragTestId, dayTestId }) => {
          const source = document.querySelector<HTMLElement>(
            `[data-testid="${dragTestId}"]`,
          );
          const target = document.querySelector<HTMLElement>(
            `[data-testid="${dayTestId}"]`,
          );
          if (!source || !target) return null;
          source.scrollIntoView({ block: "center", inline: "center" });
          const sourceRect = source.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          return {
            source: {
              x: sourceRect.x,
              y: sourceRect.y,
              width: sourceRect.width,
              height: sourceRect.height,
            },
            target: {
              x: targetRect.x,
              y: targetRect.y,
              width: targetRect.width,
              height: targetRect.height,
            },
          };
        },
        {
          dragTestId: `planning-drag-tarefa-${draggedTask.id}`,
          dayTestId: `planning-day-${followingDayKey}`,
        },
      );
      const sourceBox = dragGeometry?.source;
      const targetBox = dragGeometry?.target;
      expect(sourceBox).toBeTruthy();
      expect(targetBox).toBeTruthy();

      const delayedMoveUrl = `**/api/planeamento/tarefa/${draggedTask.id}`;
      await page.route(delayedMoveUrl, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue();
      });
      const dragResponse = page.waitForResponse(
        (response) =>
          response.url().includes(
            `/api/planeamento/tarefa/${draggedTask.id}`,
          ) &&
          response.request().method() === "PATCH",
      );
      await page.mouse.move(
        sourceBox!.x + sourceBox!.width / 2,
        sourceBox!.y + sourceBox!.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        sourceBox!.x + sourceBox!.width / 2 + 12,
        sourceBox!.y + sourceBox!.height / 2,
        { steps: 4 },
      );
      await page.mouse.move(
        targetBox!.x + targetBox!.width / 2,
        targetBox!.y + targetBox!.height / 2,
        { steps: 12 },
      );
      await page.mouse.up();
      await expect(
        followingDayColumn.getByTestId(
          `planning-item-tarefa-${draggedTask.id}`,
        ),
      ).toBeVisible({ timeout: 500 });
      expect((await dragResponse).ok()).toBeTruthy();
      await page.unroute(delayedMoveUrl);

      await planningItem.click();

      const localValue = `${targetDayKey}T10:30`;

      await page.getByTestId("planning-edit-date").fill(localValue);
      const updateResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/planeamento/tarefa/${task.id}`) &&
          response.request().method() === "PATCH",
      );
      await page.getByTestId("planning-save-item").click();
      expect((await updateResponse).ok()).toBeTruthy();

      const taskResponse = await page.context().request.get(
        `/api/tarefas/${task.id}`,
      );
      expect(taskResponse.ok()).toBeTruthy();
      const updatedTask = await taskResponse.json();
      expect(new Date(updatedTask.dueDate).getTime()).toBe(scheduled.getTime());

      await planningItem.click();
      await page.getByRole("button", { name: /Abrir detalhe/i }).click();
      await expect(page).toHaveURL(
        new RegExp(`/tarefas/${task.id}\\?returnTo=`),
      );
      await page.getByTestId("button-back").click();
      await expect(page).toHaveURL(/\/planeamento\?week=/);
      await expect(
        page.getByRole("heading", { name: "Organizar a semana" }),
      ).toBeVisible();

      const planningVisitItem = page.getByTestId(
        `planning-item-visita-${planningVisit.id}`,
      );
      await expect(planningVisitItem).toBeVisible();
      await planningVisitItem.click();
      await page.getByRole("button", { name: /Abrir detalhe/i }).click();
      await expect(page).toHaveURL(/\/visitas\/[^?]+\?returnTo=/);
      await page.getByTestId("button-voltar").click();
      await expect(page).toHaveURL(/\/planeamento\?week=/);

      await page.getByTestId(`planning-add-${targetDayKey}`).click();
      await page.getByTestId(`planning-add-task-${targetDayKey}`).click();
      await expect(page).toHaveURL(/\/tarefas\/nova\?.*returnTo=/);
      await expect(page.getByTestId("input-due-date")).toHaveValue(
        `${targetDayKey}T09:00`,
      );
      await page.getByTestId("input-titulo").fill(contextualTitle);
      const contextualCreateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/tarefas") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-submit").click();
      const contextualResponse = await contextualCreateResponse;
      expect(contextualResponse.ok()).toBeTruthy();
      contextualTaskId = (await contextualResponse.json()).id;
      await expect(page).toHaveURL(/\/planeamento\?week=/);
      await expect(
        page.getByTestId(`planning-item-tarefa-${contextualTaskId}`),
      ).toBeVisible();
      await page.context().request.patch(
        `/api/tarefas/${contextualTaskId}`,
        { data: { status: "done" } },
      );
    } finally {
      await page.context().request.patch(`/api/tarefas/${task.id}`, {
        data: { status: "done" },
      });
      await page.waitForTimeout(300);
      if (contextualTaskId) {
        await page.context().request.delete(
          `/api/tarefas/${contextualTaskId}`,
        );
      }
      for (const overflowTask of overflowTasks) {
        await page.context().request.delete(
          `/api/tarefas/${overflowTask.id}`,
        );
      }
      await page.context().request.delete(`/api/tarefas/${task.id}`);
      await page.context().request.delete(`/api/visitas/${planningVisit.id}`);
      await page.context().request.delete(`/api/entidades/${planningEntity.id}`);
    }
  });

  test("login and auth bootstrap", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await login(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("body")).toContainText(/Dashboard|Hoje|Visitas|Tarefas/i);
    expect(consoleErrors).toEqual([]);
  });

  test("user can create an account and log in again with email", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    const unique = Date.now().toString(36);
    const email = `conta-${unique}@example.test`;
    const companyName = `Empresa E2E ${unique}`;
    const password = "Teste seguro 2026!";

    try {
      await page.goto("/");
      await expect(page.getByTestId("tab-register")).toBeVisible();
      await page.getByTestId("tab-register").click();
      await page.getByTestId("input-name").fill("Maria Teste");
      await page.getByTestId("input-company").fill(companyName);
      await page.getByTestId("input-email").fill(email);
      await page.getByTestId("input-password").fill(password);
      await page.getByTestId("input-password-confirmation").fill(password);
      const registerResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/register") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-register").click();
      const registerResponse = await registerResponsePromise;
      expect(registerResponse.status()).toBe(201);

      await expect(
        page.getByRole("heading", { name: /Dashboard/ }).first(),
      ).toBeVisible({ timeout: 15_000 });
      const meResponse = await page.context().request.get("/api/auth/me");
      expect(meResponse.ok()).toBeTruthy();
      const me = await meResponse.json();
      expect(me).toMatchObject({
        email,
        role: "admin",
        empresa: { nome: companyName },
      });
      expect(me).not.toHaveProperty("passwordHash");

      const usersResponse = await page.context().request.get(
        "/api/admin/utilizadores",
      );
      expect(usersResponse.ok()).toBeTruthy();
      const companyUsers = await usersResponse.json();
      expect(companyUsers).toHaveLength(1);
      expect(companyUsers[0]).not.toHaveProperty("passwordHash");
      expect(companyUsers[0]).toMatchObject({
        email,
        isOwner: true,
      });

      const invitedEmail = `agente-${unique}@example.test`;
      await db
        .update(empresas)
        .set({ licenseMaxUsers: 2 })
        .where(eq(empresas.id, me.empresa.id));
      const inviteResponse = await page.context().request.post(
        "/api/admin/utilizadores",
        {
          data: {
            email: invitedEmail,
            firstName: "Agente",
            lastName: "Convidado",
            role: "agent",
          },
        },
      );
      expect(inviteResponse.status()).toBe(201);
      const invitePayload = await inviteResponse.json();
      expect(invitePayload.developmentInvitationUrl).toBeTruthy();
      expect(invitePayload.user).toMatchObject({
        email: invitedEmail,
        role: "agent",
        isOwner: false,
        acceptedAt: null,
      });

      const seatLimitResponse = await page.context().request.post(
        "/api/admin/utilizadores",
        {
          data: {
            email: `sem-lugar-${unique}@example.test`,
            role: "agent",
          },
        },
      );
      expect(seatLimitResponse.status()).toBe(409);

      const ownerProtectionResponse = await page.context().request.patch(
        `/api/admin/utilizadores/${me.id}`,
        { data: { ativo: false } },
      );
      expect(ownerProtectionResponse.status()).toBe(403);

      await page.context().request.post("/api/auth/logout");
      const invitationUrl = new URL(invitePayload.developmentInvitationUrl);
      await page.goto(`${invitationUrl.pathname}${invitationUrl.search}`);
      await expect(page.getByTestId("input-reset-password")).toBeVisible();
      const invitedPassword = "Agente seguro 2026!";
      await page.getByTestId("input-reset-password").fill(invitedPassword);
      await page
        .getByTestId("input-reset-password-confirmation")
        .fill(invitedPassword);
      await page.getByTestId("button-reset-submit").click();
      await expect(page.getByTestId("button-reset-back-to-login")).toBeVisible();
      await page.getByTestId("button-reset-back-to-login").click();
      await page.getByTestId("input-email").fill(invitedEmail);
      await page.getByTestId("input-password").fill(invitedPassword);
      await page.getByTestId("button-login").click();
      await expect(
        page.getByRole("heading", { name: "Dashboard" }),
      ).toBeVisible({ timeout: 15_000 });
      const invitedMeResponse = await page.context().request.get("/api/auth/me");
      expect(await invitedMeResponse.json()).toMatchObject({
        email: invitedEmail,
        role: "agent",
        isOwner: false,
        acceptedAt: expect.any(String),
        empresa: { id: me.empresa.id, nome: companyName },
      });
      await page.context().request.post("/api/auth/logout");
      const ownerLoginResponse = await page.context().request.post(
        "/api/auth/login",
        { data: { email, password } },
      );
      expect(ownerLoginResponse.ok()).toBeTruthy();

      const logoutResponse = await page.context().request.post("/api/auth/logout");
      expect(logoutResponse.ok()).toBeTruthy();
      await page.goto("/");
      await page.getByTestId("input-email").fill(email);
      await page.getByTestId("input-password").fill(password);
      const loginResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/login") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-login").click();
      const loginResponse = await loginResponsePromise;
      expect(loginResponse.ok()).toBeTruthy();
      await expect(
        page.getByRole("heading", { name: /Dashboard/ }).first(),
      ).toBeVisible({ timeout: 15_000 });

      await page.context().request.post("/api/auth/logout");
      await page.goto("/");
      await page.getByTestId("button-forgot-password").click();
      await expect(page.getByTestId("input-forgot-email")).toBeVisible();
      await page.getByTestId("input-forgot-email").fill(email);
      const forgotResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/password/forgot") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-forgot-submit").click();
      const forgotResponse = await forgotResponsePromise;
      expect(forgotResponse.ok()).toBeTruthy();
      const forgotPayload = await forgotResponse.json();
      expect(forgotPayload.message).toMatch(/Se existir uma conta/i);
      expect(forgotPayload.developmentResetUrl).toBeTruthy();

      const resetUrl = new URL(forgotPayload.developmentResetUrl);
      const resetToken = resetUrl.searchParams.get("resetToken");
      expect(resetToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await page.goto(`${resetUrl.pathname}${resetUrl.search}`);
      await expect(page.getByTestId("input-reset-password")).toBeVisible();

      const newPassword = "Nova password segura 2026!";
      await page.getByTestId("input-reset-password").fill(newPassword);
      await page
        .getByTestId("input-reset-password-confirmation")
        .fill(newPassword);
      const resetResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/password/reset") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-reset-submit").click();
      const resetResponse = await resetResponsePromise;
      expect(resetResponse.ok()).toBeTruthy();
      await expect(page.getByTestId("button-reset-back-to-login")).toBeVisible();

      const reusedTokenResponse = await page.context().request.post(
        "/api/auth/password/reset",
        { data: { token: resetToken, password: "Outra password segura 2026!" } },
      );
      expect(reusedTokenResponse.status()).toBe(400);

      const oldPasswordResponse = await page.context().request.post(
        "/api/auth/login",
        { data: { email, password } },
      );
      expect(oldPasswordResponse.status()).toBe(401);

      await page.getByTestId("button-reset-back-to-login").click();
      await page.getByTestId("input-email").fill(email);
      await page.getByTestId("input-password").fill(newPassword);
      await page.getByTestId("button-login").click();
      await expect(
        page.getByRole("heading", { name: /Dashboard/ }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await page.context().request.post("/api/auth/logout");

      const expiringForgotResponse = await page.context().request.post(
        "/api/auth/password/forgot",
        { data: { email } },
      );
      expect(expiringForgotResponse.ok()).toBeTruthy();
      const expiringForgotPayload = await expiringForgotResponse.json();
      const expiringUrl = new URL(expiringForgotPayload.developmentResetUrl);
      const expiringToken = expiringUrl.searchParams.get("resetToken")!;
      const [account] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      const [storedReset] = await db
        .select({ tokenHash: passwordResetTokens.tokenHash })
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.userId, account.id))
        .orderBy(passwordResetTokens.createdAt)
        .limit(1);
      expect(storedReset.tokenHash).not.toBe(expiringToken);
      expect(storedReset.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      await db
        .update(passwordResetTokens)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(passwordResetTokens.userId, account.id));

      const expiredValidationResponse = await page.context().request.get(
        `/api/auth/password/reset/validate?token=${encodeURIComponent(expiringToken)}`,
      );
      expect(await expiredValidationResponse.json()).toEqual({ valid: false });
      const expiredResetResponse = await page.context().request.post(
        "/api/auth/password/reset",
        { data: { token: expiringToken, password: "Outra password segura 2026!" } },
      );
      expect(expiredResetResponse.status()).toBe(400);

      const unknownForgotResponse = await page.context().request.post(
        "/api/auth/password/forgot",
        { data: { email: `unknown-${email}` } },
      );
      expect(unknownForgotResponse.ok()).toBeTruthy();
      const unknownForgotPayload = await unknownForgotResponse.json();
      expect(unknownForgotPayload.message).toBe(forgotPayload.message);
      expect(unknownForgotPayload).not.toHaveProperty("developmentResetUrl");

      const duplicateResponse = await page.context().request.post(
        "/api/auth/register",
        {
          data: {
            name: "Outra Pessoa",
            companyName: "Outra Empresa",
            email: email.toUpperCase(),
            password,
          },
        },
      );
      expect(duplicateResponse.status()).toBe(409);

      const weakPasswordResponse = await page.context().request.post(
        "/api/auth/register",
        {
          data: {
            name: "Outra Pessoa",
            companyName: "Outra Empresa",
            email: `weak-${email}`,
            password: "curta",
          },
        },
      );
      expect(weakPasswordResponse.status()).toBe(400);
    } finally {
      await db.delete(empresas).where(eq(empresas.nome, companyName));
    }
  });

  test("user can create an account and return with a Microsoft identity", async ({
    page,
  }) => {
    const unique = Date.now().toString(36);
    const email = `microsoft-${unique}@example.test`;
    const subject = `microsoft-subject-${unique}`;
    const companyName = `Empresa Social E2E ${unique}`;
    const callbackData = {
      provider: "microsoft",
      claims: {
        sub: subject,
        preferred_username: email,
        name: "Marta Microsoft",
      },
    };

    try {
      await page.goto("/");
      const firstCallback = await page.context().request.post(
        "/api/dev/auth/social-callback",
        { data: callbackData },
      );
      expect(firstCallback.ok()).toBeTruthy();
      expect(await firstCallback.json()).toEqual({ result: "pending" });

      await page.goto("/login?social=complete");
      await expect(page.getByText(email)).toBeVisible();
      await page.getByTestId("input-social-company").fill(companyName);
      const completeResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/social/complete") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-social-complete").click();
      expect((await completeResponsePromise).status()).toBe(201);
      await expect(page.getByText("NAVEGAÇÃO")).toBeVisible();

      const [identity] = await db
        .select({
          provider: externalIdentities.provider,
          subject: externalIdentities.subject,
          passwordHash: users.passwordHash,
        })
        .from(externalIdentities)
        .innerJoin(users, eq(users.id, externalIdentities.userId))
        .where(
          and(
            eq(externalIdentities.provider, "microsoft"),
            eq(externalIdentities.subject, subject),
          ),
        );
      expect(identity).toEqual({
        provider: "microsoft",
        subject,
        passwordHash: null,
      });

      await page.context().request.post("/api/auth/logout");
      const returningCallback = await page.context().request.post(
        "/api/dev/auth/social-callback",
        { data: callbackData },
      );
      expect(await returningCallback.json()).toEqual({
        result: "authenticated",
      });
      const meResponse = await page.context().request.get("/api/auth/me");
      expect(meResponse.ok()).toBeTruthy();
      expect(await meResponse.json()).toMatchObject({
        email,
        isOwner: true,
        empresa: { nome: companyName },
      });

      const invitedEmail = `microsoft-agent-${unique}@example.test`;
      const invitedSubject = `microsoft-agent-subject-${unique}`;
      const inviteResponse = await page.context().request.post(
        "/api/admin/utilizadores",
        {
          data: {
            email: invitedEmail,
            firstName: "Miguel",
            lastName: "Agente",
            role: "agent",
          },
        },
      );
      expect(inviteResponse.status()).toBe(201);
      await page.context().request.post("/api/auth/logout");

      const invitedCallback = await page.context().request.post(
        "/api/dev/auth/social-callback",
        {
          data: {
            provider: "microsoft",
            claims: {
              sub: invitedSubject,
              preferred_username: invitedEmail,
              name: "Miguel Agente",
            },
          },
        },
      );
      expect(await invitedCallback.json()).toEqual({
        result: "authenticated",
      });
      const invitedMe = await page.context().request.get("/api/auth/me");
      expect(await invitedMe.json()).toMatchObject({
        email: invitedEmail,
        role: "agent",
        isOwner: false,
        acceptedAt: expect.any(String),
        empresa: { nome: companyName },
      });
    } finally {
      await db.delete(empresas).where(eq(empresas.nome, companyName));
    }
  });

  test("gps proximity endpoint is available at the frontend URL", async ({
    page,
  }) => {
    await login(page);
    const response = await page.context().request.post(
      "/api/visitas/proximidade",
      { data: { lat: 38.7223, lng: -9.1393 } },
    );
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toHaveProperty("sugestao");
  });

  test("pwa manifest exposes complete icons and a safe service worker", async ({
    request,
  }) => {
    const manifestResponse = await request.get("/manifest.json");
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = await manifestResponse.json();
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/icon-512.png", sizes: "512x512" }),
        expect.objectContaining({
          src: "/icon-maskable-512.png",
          purpose: "maskable",
        }),
      ]),
    );

    for (const iconPath of [
      "/icon-192.png",
      "/icon-512.png",
      "/icon-maskable-512.png",
    ]) {
      const iconResponse = await request.get(iconPath);
      expect(iconResponse.ok()).toBeTruthy();
      expect(iconResponse.headers()["content-type"]).toContain("image/png");
    }

    const workerResponse = await request.get("/sw.js");
    expect(workerResponse.ok()).toBeTruthy();
    const worker = await workerResponse.text();
    expect(worker).toContain('url.protocol !== "http:"');
    expect(worker).toContain('url.pathname.startsWith("/api/")');
  });

  test("perfil page loads settings data", async ({ page }) => {
    await login(page);
    await page.goto("/perfil");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Perfil/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/N.+o foi poss.+vel carregar defini.+es/i);
    await expect(page.locator("body")).toContainText(/Prefer.+ncias de Interface/i);
    await expect(page.locator("body")).toContainText(/Notifica.+es/i);
  });

  test("analytics page loads data without internal error", async ({ page }) => {
    await login(page);
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Analytics/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Erro ao carregar analytics/i);
    await expect(page.getByTestId("kpi-total-visits")).toBeVisible();
  });

  test("lembretes page loads with valid empty state or reminders", async ({ page }) => {
    await login(page);
    await page.goto("/lembretes");
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("text-page-title")).toContainText(/Lembretes/i);
    await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);
  });

  test("my odoo requests page loads without fetch error", async ({ page }) => {
    await login(page);
    await page.goto("/me/odoo-requests");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).toContainText(/Os meus pedidos/i);
    await expect(page.locator("body")).not.toContainText(/Erro ao carregar pedidos/i);
  });

  test("microsoft integration route loads a live page", async ({ page }) => {
    await login(page);
    await page.goto("/integracoes/microsoft");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/integracoes\/microsoft$/);
    await expect(page.getByTestId("card-microsoft-integration-page")).toBeVisible();
  });

  test("legacy gabinetes routes redirect to entidades", async ({ page }) => {
    await login(page);

    await page.goto("/gabinetes");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/entidades$/);

    await page.goto("/gabinetes/novo");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/entidades\/nova$/);
  });

  test("secondary routed pages load without runtime failures", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const requiredModules = {
      crmLeadsEnabled: true,
      odooContactsFeatureEnabled: true,
      odooContactsAdminEnabled: true,
    };
    const enableResponse = await page.context().request.patch("/api/admin/empresa", {
      data: requiredModules,
    });
    expect(enableResponse.ok()).toBeTruthy();

    const paths = [
      "/leads",
      "/admin/leads",
      "/agente-mais",
      "/admin/odoo-contact-requests",
    ];

    try {
      for (const path of paths) {
        await test.step(path, async () => {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);
          await expect(page.locator("body")).not.toContainText(/404/i);
        });
      }
    } finally {
      await page.context().request.patch("/api/admin/empresa", {
        data: {
          crmLeadsEnabled: !!originalEmpresa?.crmLeadsEnabled,
          odooContactsFeatureEnabled:
            !!originalEmpresa?.odooContactsFeatureEnabled,
          odooContactsAdminEnabled:
            !!originalEmpresa?.odooContactsAdminEnabled,
        },
      });
    }
  });

  test("main pages load without 5xx api failures", async ({ page }) => {
    test.setTimeout(120_000);

    const consoleErrors: string[] = [];
    const failedApiResponses: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("response", async (response) => {
      if (
        response.url().includes("/api/") &&
        response.status() >= 500
      ) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page);

    const paths = [
      "/",
      "/entidades",
      "/contactos",
      "/visitas",
      "/tarefas",
      "/admin/empresa",
      "/admin/debug",
    ];

    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);
    }

    expect(failedApiResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("new-form pages load without console or api failures", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedApiResponses: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("response", async (response) => {
      if (response.url().includes("/api/") && response.status() >= 500) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page);

    const paths = [
      "/entidades/nova",
      "/contactos/novo",
      "/visitas/nova",
      "/tarefas/nova",
    ];

    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);
    }

    expect(failedApiResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("search selects open immediately with scrollable and filtered results", async ({
    page,
  }) => {
    await login(page);

    const suffix = Date.now().toString();
    const entityNames = Array.from(
      { length: 12 },
      (_, index) => `00 Pesquisa ${suffix} ${String(index + 1).padStart(2, "0")}`,
    );
    const createdEntities: Array<{ id: string }> = [];

    try {
      for (const nome of entityNames) {
        const response = await page.context().request.post("/api/entidades", {
          data: { nome, tipoEntidade: "Gabinete" },
        });
        expect(response.ok()).toBeTruthy();
        createdEntities.push(await response.json());
      }

      await page.goto("/contactos/novo");
      const searchInput = page.getByTestId("input-search-select");
      await searchInput.focus();

      const results = page.getByTestId("search-select-results");
      await expect(results).toBeVisible();
      await expect(results.getByText(entityNames[0], { exact: true })).toBeVisible();
      await expect(results.getByText(entityNames[11], { exact: true })).toBeVisible();

      const scrollState = await results.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          overflowY: style.overflowY,
          hasOverflow: element.scrollHeight > element.clientHeight,
        };
      });
      expect(scrollState.overflowY).toBe("auto");
      expect(scrollState.hasOverflow).toBeTruthy();

      await searchInput.fill(entityNames[7]);
      await expect(
        results.getByText(entityNames[7], { exact: true }),
      ).toBeVisible();
      await expect(
        results.getByText(entityNames[0], { exact: true }),
      ).toHaveCount(0);
    } finally {
      for (const entity of createdEntities) {
        await page.context().request.delete(`/api/entidades/${entity.id}`);
      }
    }
  });

  test("odoo partner search loads immediately and filters while typing", async ({
    page,
  }) => {
    test.skip(
      !process.env.ODOO_URL ||
        !process.env.ODOO_DB ||
        !process.env.ODOO_USER ||
        !process.env.ODOO_PASS,
      "Odoo is not configured in this environment",
    );

    await login(page);
    await page.goto("/entidades");

    const initialSearchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/integrations/odoo/search-partner?q=") &&
        response.request().method() === "GET",
    );
    await page.getByTestId("button-import-odoo-entidades").click();
    const initialPayload = await (await initialSearchResponse).json();

    expect(initialPayload.connectionError).not.toBeTruthy();
    expect(Array.isArray(initialPayload.results)).toBeTruthy();
    const resultsList = page.getByTestId("list-odoo-entidade-search-results");
    await expect(resultsList).toBeVisible();

    if (initialPayload.results.length > 0) {
      const partnerName = initialPayload.results[0].name;
      await expect(
        page.getByTestId(/^button-import-odoo-entidade-/).first(),
      ).toBeVisible();

      const filteredSearchResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === "/api/integrations/odoo/search-partner" &&
          url.searchParams.get("q") === partnerName
        );
      });
      await page.getByTestId("input-odoo-entidade-search").fill(partnerName);
      const filteredPayload = await (await filteredSearchResponse).json();

      expect(filteredPayload.connectionError).not.toBeTruthy();
      expect(Array.isArray(filteredPayload.results)).toBeTruthy();
      await expect(
        resultsList.getByText(partnerName, { exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("contact creation rejects duplicate email and phone safely", async ({
    page,
  }) => {
    await login(page);
    const suffix = Date.now().toString();
    const email = `dedupe-${suffix}@example.test`;
    const phoneDigits = `91${suffix.slice(-7)}`;
    const createdIds: string[] = [];
    let foreignCompanyId: string | null = null;

    try {
      const originalResponse = await page.context().request.post(
        "/api/contactos",
        {
          data: {
            nome: `Contacto original ${suffix}`,
            email,
            telemovel: `+351 ${phoneDigits}`,
          },
        },
      );
      expect(originalResponse.status()).toBe(201);
      const original = await originalResponse.json();
      createdIds.push(original.id);

      const duplicateEmailResponse = await page.context().request.post(
        "/api/contactos",
        {
          data: {
            nome: `Duplicado email ${suffix}`,
            email: `  ${email.toUpperCase()}  `,
          },
        },
      );
      expect(duplicateEmailResponse.status()).toBe(409);
      expect(await duplicateEmailResponse.json()).toMatchObject({
        code: "CONTACT_DUPLICATE",
        matchedBy: "email",
        existingContact: { id: original.id },
      });

      const duplicatePhoneResponse = await page.context().request.post(
        "/api/contactos",
        {
          data: {
            nome: `Duplicado telefone ${suffix}`,
            telemovel: phoneDigits,
          },
        },
      );
      expect(duplicatePhoneResponse.status()).toBe(409);
      expect(await duplicatePhoneResponse.json()).toMatchObject({
        code: "CONTACT_DUPLICATE",
        matchedBy: "phone",
        existingContact: { id: original.id },
      });

      const secondResponse = await page.context().request.post(
        "/api/contactos",
        {
          data: {
            nome: `Contacto editável ${suffix}`,
            email: `outro-${suffix}@example.test`,
          },
        },
      );
      expect(secondResponse.status()).toBe(201);
      const second = await secondResponse.json();
      createdIds.push(second.id);

      const duplicateUpdateResponse = await page.context().request.patch(
        `/api/contactos/${second.id}`,
        { data: { email } },
      );
      expect(duplicateUpdateResponse.status()).toBe(409);

      const tenantEmail = `partilhado-${suffix}@example.test`;
      const [foreignCompany] = await db
        .insert(empresas)
        .values({ nome: `Empresa externa dedupe ${suffix}` })
        .returning();
      foreignCompanyId = foreignCompany.id;
      await db.insert(contactos).values({
        empresaId: foreignCompany.id,
        nome: `Contacto de outra empresa ${suffix}`,
        email: tenantEmail,
      });

      const sameEmailOtherCompanyResponse = await page.context().request.post(
        "/api/contactos",
        {
          data: {
            nome: `Contacto empresa atual ${suffix}`,
            email: tenantEmail,
          },
        },
      );
      expect(sameEmailOtherCompanyResponse.status()).toBe(201);
      createdIds.push((await sameEmailOtherCompanyResponse.json()).id);

      const concurrentEmail = `concorrente-${suffix}@example.test`;
      const concurrentResponses = await Promise.all([
        page.context().request.post("/api/contactos", {
          data: { nome: `Concorrente A ${suffix}`, email: concurrentEmail },
        }),
        page.context().request.post("/api/contactos", {
          data: { nome: `Concorrente B ${suffix}`, email: concurrentEmail },
        }),
      ]);
      expect(concurrentResponses.map((response) => response.status()).sort()).toEqual([
        201,
        409,
      ]);
      for (const response of concurrentResponses) {
        if (response.status() === 201) {
          createdIds.push((await response.json()).id);
        }
      }
    } finally {
      for (const id of createdIds) {
        await page.context().request.delete(`/api/contactos/${id}`);
      }
      if (foreignCompanyId) {
        await db.delete(empresas).where(eq(empresas.id, foreignCompanyId));
      }
    }
  });

  test("odoo import reuses a matching local contact", async ({ page }) => {
    test.skip(
      !process.env.ODOO_URL ||
        !process.env.ODOO_DB ||
        !process.env.ODOO_USER ||
        !process.env.ODOO_PASS,
      "Odoo is not configured in this environment",
    );

    await login(page);
    const partnersResponse = await page.context().request.get(
      "/api/integrations/odoo/search-partner?q=",
    );
    expect(partnersResponse.ok()).toBeTruthy();
    const partnersPayload = await partnersResponse.json();
    expect(partnersPayload.connectionError).not.toBeTruthy();

    const contactsResponse = await page.context().request.get("/api/contactos");
    const localContacts = await contactsResponse.json();
    const normalizeEmail = (value: unknown) =>
      String(value ?? "").trim().toLowerCase();
    const normalizePhone = (value: unknown) =>
      String(value ?? "").replace(/\D/g, "");
    const partner = (partnersPayload.results ?? []).find((candidate: any) => {
      const email = normalizeEmail(candidate.email);
      const phone = normalizePhone(candidate.phone);
      if (!email && phone.length < 7) return false;
      return !(localContacts ?? []).some(
        (contact: any) =>
          String(contact.odooPartnerId ?? "") === String(candidate.id) ||
          (email && normalizeEmail(contact.email) === email) ||
          (phone.length >= 7 && normalizePhone(contact.telemovel) === phone),
      );
    });
    test.skip(!partner, "No unused Odoo partner with a stable identifier was found");

    let localContactId: string | null = null;
    try {
      const localResponse = await page.context().request.post("/api/contactos", {
        data: {
          nome: `Local antes do Odoo ${Date.now()}`,
          email: partner.email || undefined,
          telemovel: partner.phone || undefined,
        },
      });
      expect(localResponse.status()).toBe(201);
      const localContact = await localResponse.json();
      localContactId = localContact.id;

      const importResponse = await page.context().request.post(
        `/api/integrations/odoo/sync/partners/${partner.id}/import-contact`,
        { data: {} },
      );
      expect(importResponse.ok()).toBeTruthy();
      const imported = await importResponse.json();
      expect(imported).toMatchObject({
        success: true,
        direction: "pull-update-existing",
        deduplicated: true,
        contacto: {
          id: localContact.id,
          odooPartnerId: String(partner.id),
        },
      });
    } finally {
      if (localContactId) {
        await page.context().request.delete(`/api/contactos/${localContactId}`);
      }
    }
  });

  test("create entity and task through UI", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedApiResponses: string[] = [];
    const entityName = "ZZ UI Entidade";
    const taskTitle = "ZZ UI Tarefa";

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("response", async (response) => {
      if (response.url().includes("/api/") && response.status() >= 500) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page);

    await page.goto("/entidades/nova");
    await page.getByPlaceholder("Nome da empresa...").fill(entityName);
    await page.getByRole("button", { name: /Guardar Entidade/i }).click();
    await expect(page).toHaveURL(/\/entidades$/);

    const entityId = await cleanupByName(page, "/api/entidades", entityName);
    expect(entityId).toBeTruthy();

    await page.goto("/tarefas/nova");
    await page.getByTestId("input-titulo").fill(taskTitle);
    await page.getByRole("button", { name: /Criar Tarefa/i }).click();
    await expect(page).toHaveURL(/\/tarefas$/);

    const tasksResponse = await page.context().request.get("/api/tarefas");
    const tasks = await tasksResponse.json();
    const createdTask = Array.isArray(tasks)
      ? tasks.find((task: any) => task?.titulo === taskTitle)
      : null;
    expect(createdTask?.id).toBeTruthy();

    await page.context().request.delete(`/api/tarefas/${createdTask.id}`);
    await page.context().request.delete(`/api/entidades/${entityId}`);

    expect(failedApiResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("international entity research settings are applied safely", async ({ page }) => {
    await login(page);
    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const originalUiSettings = originalEmpresa?.uiSettings ?? {};
    const entityName = `ZZ Entidade Espanha ${Date.now()}`;
    let entityId: string | undefined;

    try {
      const settingsResponse = await page.context().request.patch("/api/admin/empresa", {
        data: {
          uiSettings: {
            ...originalUiSettings,
            entityResearch: {
              internationalEnabled: true,
              defaultCountry: "ES",
              viesEnabled: false,
              odooNameSearchEnabled: false,
              postalLookupEnabled: false,
              aiFallbackEnabled: false,
              askBeforeAi: true,
            },
          },
        },
      });
      expect(settingsResponse.ok()).toBeTruthy();

      await page.goto("/admin/empresa");
      await page.getByTestId("tab-empresa-pesquisa-entidades").click();
      await expect(page.getByText("Pesquisa de entidades", { exact: true })).toBeVisible();

      await page.goto("/entidades/nova");
      await expect(page.getByTestId("select-entity-country")).toContainText("Espanha");
      await page.getByPlaceholder("Nome da empresa...").fill(entityName);
      await expect(page.getByTestId("card-suggestions")).toBeVisible();
      await page.getByTestId("button-close-suggestions").click();
      await page.getByTestId("input-nif").fill("B12345678");
      await page.getByRole("button", { name: /Guardar Entidade/i }).click();
      await expect(page).toHaveURL(/\/entidades$/);

      const entitiesResponse = await page.context().request.get("/api/entidades");
      expect(entitiesResponse.ok()).toBeTruthy();
      const entities = await entitiesResponse.json();
      const createdEntity = Array.isArray(entities)
        ? entities.find((entity: any) => entity?.nome === entityName)
        : null;
      expect(createdEntity?.countryCode).toBe("ES");
      expect(createdEntity?.nif).toBe("B12345678");
      entityId = createdEntity?.id;
    } finally {
      if (entityId) await page.context().request.delete(`/api/entidades/${entityId}`);
      await page.context().request.patch("/api/admin/empresa", {
        data: { uiSettings: originalUiSettings },
      });
    }
  });

  test("Odoo entity search setting persists immediately and returns partners", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const originalUiSettings = originalEmpresa?.uiSettings ?? {};

    try {
      await page.goto("/admin/empresa");
      await page.getByTestId("tab-empresa-pesquisa-entidades").click();
      const odooSwitch = page.getByTestId("switch-entity-odoo-search");
      await expect(odooSwitch).toBeVisible();

      if (await odooSwitch.isChecked()) {
        const disableResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/admin/empresa") &&
            response.request().method() === "PATCH",
        );
        await odooSwitch.setChecked(false);
        expect((await disableResponse).ok()).toBeTruthy();
      }

      await expect(odooSwitch).toBeEnabled();
      const enableResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/admin/empresa") &&
          response.request().method() === "PATCH",
      );
      await odooSwitch.setChecked(true);
      expect((await enableResponse).ok()).toBeTruthy();

      const savedResponse = await page.context().request.get("/api/admin/empresa");
      expect(savedResponse.ok()).toBeTruthy();
      const savedEmpresa = await savedResponse.json();
      expect(savedEmpresa.uiSettings.entityResearch.odooNameSearchEnabled).toBe(true);

      const searchResponse = await page.context().request.post(
        "/api/enrichment/pt-intelligent-search",
        { data: { nome: "Sanibanho" } },
      );
      expect(searchResponse.ok()).toBeTruthy();
      const searchPayload = await searchResponse.json();
      expect(searchPayload.odooUnavailable).toBe(false);
      expect(
        searchPayload.fuzzyMatches.some(
          (match: { source?: string; candidate?: string }) =>
            match.source === "odoo" &&
            match.candidate?.toLocaleLowerCase("pt-PT").includes("sanibanho"),
        ),
      ).toBe(true);
    } finally {
      await page.context().request.patch("/api/admin/empresa", {
        data: { uiSettings: originalUiSettings },
      });
    }
  });

  test("VIES, postal code and address searches work in the entity form", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const originalUiSettings = originalEmpresa?.uiSettings ?? {};

    try {
      const settingsResponse = await page.context().request.patch("/api/admin/empresa", {
        data: {
          uiSettings: {
            ...originalUiSettings,
            entityResearch: {
              ...(originalUiSettings.entityResearch ?? {}),
              viesEnabled: true,
              postalLookupEnabled: true,
            },
          },
        },
      });
      expect(settingsResponse.ok()).toBeTruthy();

      await page.goto("/entidades/nova");
      await page.getByTestId("input-nif").fill("999999990");
      const viesResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/enrichment/vat/validate") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-validate-vat").click();
      expect((await viesResponse).ok()).toBeTruthy();
      await expect(page.getByTestId("vat-invalid")).toBeVisible();

      const postalResponse = page.waitForResponse((response) =>
        response.url().includes("/api/enrichment/postal-code/1250-096"),
      );
      await page.getByTestId("input-codigo-postal").fill("1250096");
      expect((await postalResponse).ok()).toBeTruthy();
      await expect(
        page.getByTestId("select-postal-street").or(page.getByTestId("postal-locality-result")),
      ).toBeVisible();

      await page.getByTestId("input-morada").fill("Avenida da Liberdade 1");
      const addressResponse = page.waitForResponse((response) =>
        response.url().includes("/api/enrichment/address-search"),
      );
      await page.getByTestId("button-search-address").click();
      expect((await addressResponse).ok()).toBeTruthy();
      await expect(page.getByTestId("address-search-results")).toBeVisible();
    } finally {
      await page.context().request.patch("/api/admin/empresa", {
        data: { uiSettings: originalUiSettings },
      });
    }
  });

  test("agent can use entity name, VIES, postal code and address searches", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await login(page);
    const authUser = await (
      await page.context().request.get("/api/auth/me")
    ).json();
    const empresaId = authUser?.empresaId as string | undefined;
    expect(empresaId).toBeTruthy();

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const originalUiSettings = originalEmpresa?.uiSettings ?? {};
    const marker = Date.now();
    const agentId = `entity-search-agent-${marker}`;
    const agentEmail = `entity-search-agent-${marker}@example.invalid`;
    const password = `Agent-${marker}-Secure`;
    const agentContext = await browser.newContext({
      baseURL: "http://127.0.0.1:5001",
    });

    try {
      const settingsResponse = await page.context().request.patch("/api/admin/empresa", {
        data: {
          uiSettings: {
            ...originalUiSettings,
            entityResearch: {
              ...(originalUiSettings.entityResearch ?? {}),
              viesEnabled: true,
              postalLookupEnabled: true,
              odooNameSearchEnabled: true,
            },
          },
        },
      });
      expect(settingsResponse.ok()).toBeTruthy();

      await db.insert(users).values({
        id: agentId,
        email: agentEmail,
        passwordHash: await hashPassword(password),
        role: "agent",
        empresaId,
        ativo: true,
      });
      const loginResponse = await agentContext.request.post("/api/auth/login", {
        data: { email: agentEmail, password },
      });
      expect(loginResponse.ok()).toBeTruthy();

      const meResponse = await agentContext.request.get("/api/auth/me");
      expect(meResponse.ok()).toBeTruthy();
      const me = await meResponse.json();
      expect(me.role).toBe("agent");
      expect(me.empresa?.uiSettings?.entityResearch?.viesEnabled).toBe(true);
      expect(me.empresa?.uiSettings?.entityResearch?.postalLookupEnabled).toBe(true);

      const nameResponse = await agentContext.request.post(
        "/api/enrichment/pt-intelligent-search",
        { data: { nome: "Sanibanho" } },
      );
      expect(nameResponse.ok()).toBeTruthy();
      const namePayload = await nameResponse.json();
      expect(namePayload.odooUnavailable).toBe(false);
      expect(
        namePayload.fuzzyMatches.some(
          (match: { source?: string; candidate?: string }) =>
            match.source === "odoo" &&
            match.candidate?.toLocaleLowerCase("pt-PT").includes("sanibanho"),
        ),
      ).toBe(true);

      const agentPage = await agentContext.newPage();
      await agentPage.goto("/entidades/nova");
      await expect(agentPage.getByTestId("input-pt-company-search")).toBeVisible();

      await agentPage.getByTestId("input-nif").fill("999999990");
      const viesResponse = agentPage.waitForResponse(
        (response) =>
          response.url().includes("/api/enrichment/vat/validate") &&
          response.request().method() === "POST",
      );
      await agentPage.getByTestId("button-validate-vat").click();
      expect((await viesResponse).ok()).toBeTruthy();
      await expect(agentPage.getByTestId("vat-invalid")).toBeVisible();

      const postalResponse = agentPage.waitForResponse((response) =>
        response.url().includes("/api/enrichment/postal-code/1250-096"),
      );
      await agentPage.getByTestId("input-codigo-postal").fill("1250096");
      expect((await postalResponse).ok()).toBeTruthy();
      await expect(
        agentPage
          .getByTestId("select-postal-street")
          .or(agentPage.getByTestId("postal-locality-result")),
      ).toBeVisible();

      await agentPage.getByTestId("input-morada").fill("Avenida da Liberdade 1");
      const addressResponse = agentPage.waitForResponse((response) =>
        response.url().includes("/api/enrichment/address-search"),
      );
      await agentPage.getByTestId("button-search-address").click();
      expect((await addressResponse).ok()).toBeTruthy();
      await expect(agentPage.getByTestId("address-search-results")).toBeVisible();
    } finally {
      await agentContext.close();
      await db.delete(users).where(eq(users.id, agentId));
      await page.context().request.patch("/api/admin/empresa", {
        data: { uiSettings: originalUiSettings },
      });
    }
  });

  test("administrator deletes an entity through the detail page", async ({ page }) => {
    await login(page);
    const entityName = `ZZ Eliminar Entidade ${Date.now()}`;
    const createResponse = await page.context().request.post("/api/entidades", {
      data: { nome: entityName, countryCode: "PT" },
    });
    expect(createResponse.ok()).toBeTruthy();
    const entity = await createResponse.json();
    let deleted = false;

    try {
      await page.goto(`/entidades/${entity.id}`);
      await expect(page.getByTestId("button-deletar")).toBeEnabled();
      await page.getByTestId("button-deletar").click();
      await expect(page.getByTestId("dialog-delete-entidade")).toBeVisible();
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/entidades/${entity.id}`) &&
          response.request().method() === "DELETE",
      );
      await page.getByTestId("button-confirm-delete-entidade").click();
      expect((await deleteResponse).ok()).toBeTruthy();
      await expect(page).toHaveURL(/\/entidades$/);
      deleted = true;

      const getResponse = await page.context().request.get(`/api/entidades/${entity.id}`);
      expect(getResponse.status()).toBe(404);
    } finally {
      if (!deleted) await page.context().request.delete(`/api/entidades/${entity.id}`);
    }
  });

  test("create contact and visit through UI", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedApiResponses: string[] = [];
    const suffix = Date.now().toString();
    const contactName = `ZZ UI Contacto ${suffix}`;
    const entityName = `ZZ Seed Entidade Visita ${suffix}`;

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("response", async (response) => {
      if (response.url().includes("/api/") && response.status() >= 500) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page);

    await page.goto("/contactos/novo");
    await page.getByTestId("input-nome").fill(contactName);
    await page.getByTestId("button-guardar").click();
    await expect(page).toHaveURL(/\/contactos$/);

    const contactsResponse = await page.context().request.get("/api/contactos");
    const contacts = await contactsResponse.json();
    const createdContact = Array.isArray(contacts)
      ? contacts.find((contact: any) => contact?.nome === contactName)
      : null;
    expect(createdContact?.id).toBeTruthy();

    const entityResponse = await page.context().request.post("/api/entidades", {
      data: { nome: entityName, tipoEntidade: "Gabinete" },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const entity = await entityResponse.json();

    await page.goto(
      `/visitas/nova?entidadeId=${entity.id}&entidadeName=${encodeURIComponent(entityName)}`,
    );
    const createVisitButton = page.getByRole("button", { name: /Criar Visita$/i });
    await expect(createVisitButton).toBeEnabled({ timeout: 20_000 });
    await createVisitButton.click();
    await expect(page).toHaveURL(/\/visitas$/, { timeout: 20_000 });

    await expect
      .poll(
        async () => {
          try {
            const visitsResponse =
              await page.context().request.get("/api/visitas");
            if (!visitsResponse.ok()) return undefined;
            const visits = await visitsResponse.json();
            return Array.isArray(visits)
              ? visits.find((visit: any) => visit?.entidadeId === entity.id)?.id
              : undefined;
          } catch {
            return undefined;
          }
        },
        { timeout: 20_000 },
      )
      .toBeTruthy();

    await page.context().request.delete(`/api/contactos/${createdContact.id}`);
    await page.context().request.delete(`/api/entidades/${entity.id}`);

    expect(failedApiResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("admin settings expose integrations block without failures", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedApiResponses: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    page.on("response", async (response) => {
      if (response.url().includes("/api/") && response.status() >= 500) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await login(page);

    await page.goto("/admin/empresa");
    await page.getByTestId("button-section-apis-keys").click();
    await expect(page.getByTestId("card-odoo-crm-block")).toBeVisible();
    await expect(page.getByTestId("toggle-odoo-crm-enabled")).toBeVisible();
    await expect(page.getByText("Microsoft 365", { exact: true })).toBeVisible();
    await expect(page.getByText("Google Workspace", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Planeado", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Não foi possível obter o estado da ligação Microsoft/i)).toHaveCount(0);
    await expect(page.getByText(/Não foi possível obter o estado da ligação Google/i)).toHaveCount(0);

    if (process.env.ODOO_URL) {
      await expect(page.getByTestId("text-odoo-base-url")).toContainText(
        process.env.ODOO_URL,
      );
    }

    expect(failedApiResponses).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("ai and odoo api endpoints respond for authenticated user", async ({ page }) => {
    const suffix = Date.now().toString();
    const entityName = `ZZ API IA ${suffix}`;

    await login(page);

    const entityResponse = await page.context().request.post("/api/entidades", {
      data: { nome: entityName, tipoEntidade: "Gabinete" },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const entity = await entityResponse.json();

    const visitResponse = await page.context().request.post("/api/visitas", {
      multipart: {
        entidadeId: entity.id,
        dataVisita: new Date().toISOString(),
        notas: "Visita de teste para validar IA e integracoes.",
        contactosIds: "[]",
        marcasIds: "[]",
      },
    });
    expect(visitResponse.ok()).toBeTruthy();
    const visit = await visitResponse.json();

    const aiSummaryResponse = await page.context().request.post("/api/ai/visit-summary", {
      data: { visitaId: visit.id },
    });
    expect(aiSummaryResponse.ok()).toBeTruthy();
    const aiSummary = await aiSummaryResponse.json();
    expect(typeof aiSummary?.resumo).toBe("string");
    expect(aiSummary.resumo.length).toBeGreaterThan(0);

    const odooStatusResponse = await page.context().request.get("/api/integrations/odoo/status");
    expect(odooStatusResponse.ok()).toBeTruthy();
    const odooStatus = await odooStatusResponse.json();
    expect(typeof odooStatus?.configured).toBe("boolean");

    const microsoftStatusResponse = await page.context().request.get(
      "/api/integrations/microsoft/status",
    );
    expect(microsoftStatusResponse.ok()).toBeTruthy();
    const microsoftStatus = await microsoftStatusResponse.json();
    expect(typeof microsoftStatus?.connected).toBe("boolean");
    expect(typeof microsoftStatus?.oauthConfigured).toBe("boolean");

    const googleStatusResponse = await page.context().request.get(
      "/api/integrations/google/status",
    );
    expect(googleStatusResponse.ok()).toBeTruthy();
    const googleStatus = await googleStatusResponse.json();
    expect(typeof googleStatus?.connected).toBe("boolean");
    expect(typeof googleStatus?.oauthConfigured).toBe("boolean");

    if (process.env.ODOO_URL && process.env.ODOO_DB && process.env.ODOO_USER && process.env.ODOO_PASS) {
      expect(odooStatus.configured).toBeTruthy();

      const odooInitialResponse = await page.context().request.get(
        "/api/integrations/odoo/search-partner?q=",
      );
      expect(odooInitialResponse.ok()).toBeTruthy();
      const odooInitial = await odooInitialResponse.json();
      expect(
        Array.isArray(odooInitial?.results) || Boolean(odooInitial?.connectionError),
      ).toBeTruthy();
      if (Array.isArray(odooInitial?.results)) {
        expect(odooInitial.results.length).toBeLessThanOrEqual(20);
      }

      const odooSearchResponse = await page.context().request.get(
        "/api/integrations/odoo/search-partner?q=test",
      );
      expect(odooSearchResponse.ok()).toBeTruthy();
      const odooSearch = await odooSearchResponse.json();
      expect(
        Array.isArray(odooSearch?.results) || Boolean(odooSearch?.connectionError),
      ).toBeTruthy();
    }

    await page.context().request.delete(`/api/visitas/${visit.id}`);
    await page.context().request.delete(`/api/entidades/${entity.id}`);
  });

  test("edit entity, contact and task through UI", async ({ page }) => {
    const suffix = Date.now().toString();
    const initialEntityName = `ZZ Edit Entidade ${suffix}`;
    const updatedEntityPhone = `+351 91${suffix.slice(-7)}`;
    const initialContactName = `ZZ Edit Contacto ${suffix}`;
    const updatedContactRole = "Diretor Comercial";
    const initialTaskTitle = `ZZ Edit Tarefa ${suffix}`;
    const updatedTaskTitle = `ZZ Edit Tarefa Atualizada ${suffix}`;

    await login(page);

    const entityResponse = await page.context().request.post("/api/entidades", {
      data: { nome: initialEntityName, tipoEntidade: "Gabinete" },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const entity = await entityResponse.json();

    const contactResponse = await page.context().request.post("/api/contactos", {
      data: {
        nome: initialContactName,
        entidadeId: entity.id,
        email: `zz-edit-${suffix}@example.com`,
      },
    });
    expect(contactResponse.ok()).toBeTruthy();
    const contact = await contactResponse.json();

    const taskResponse = await page.context().request.post("/api/tarefas", {
      data: {
        titulo: initialTaskTitle,
        entidadeId: entity.id,
        status: "pending",
        repeatInterval: "none",
      },
    });
    expect(taskResponse.ok()).toBeTruthy();
    const task = await taskResponse.json();

    let entityPatchPayload: Record<string, unknown> | null = null;
    page.on("request", (request) => {
      if (request.method() === "PATCH" && request.url().includes(`/api/entidades/${entity.id}`)) {
        entityPatchPayload = request.postDataJSON() as Record<string, unknown>;
      }
    });

    await page.goto(`/entidades/${entity.id}/editar`);
    await page.getByTestId("input-telefone").fill(updatedEntityPhone);
    await page.getByTestId("button-guardar").click();
    await expect(page).toHaveURL(new RegExp(`/entidades/${entity.id}$`));
    expect(entityPatchPayload?.telefone).toBe(updatedEntityPhone);

    const updatedEntityResponse = await page.context().request.get(`/api/entidades/${entity.id}`);
    expect(updatedEntityResponse.ok()).toBeTruthy();
    const updatedEntity = await updatedEntityResponse.json();
    expect(updatedEntity?.telefone).toBe(updatedEntityPhone);

    await page.goto(`/contactos/${contact.id}/editar`);
    await page.getByTestId("input-funcao").fill(updatedContactRole);
    await page.getByTestId("button-guardar").click();
    await expect(page).toHaveURL(new RegExp(`/contactos/${contact.id}$`));

    const updatedContactResponse = await page.context().request.get(`/api/contactos/${contact.id}`);
    expect(updatedContactResponse.ok()).toBeTruthy();
    const updatedContact = await updatedContactResponse.json();
    expect(updatedContact?.funcao).toBe(updatedContactRole);

    await page.goto(`/tarefas/${task.id}/editar`);
    await page.getByTestId("input-titulo").fill(updatedTaskTitle);
    await page.getByTestId("button-submit").click();
    await expect(page).toHaveURL(new RegExp(`/tarefas/${task.id}$`));

    const tasksResponse = await page.context().request.get("/api/tarefas");
    expect(tasksResponse.ok()).toBeTruthy();
    const tasks = await tasksResponse.json();
    const updatedTask = Array.isArray(tasks)
      ? tasks.find((item: any) => item?.id === task.id)
      : null;
    expect(updatedTask?.titulo).toBe(updatedTaskTitle);

    await page.context().request.delete(`/api/tarefas/${task.id}`);
    await page.context().request.delete(`/api/contactos/${contact.id}`);
    await page.context().request.delete(`/api/entidades/${entity.id}`);
  });

  test("admin settings save and persist", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const updatedPhone = `+351 96${Date.now().toString().slice(-7)}`;

    await page.goto("/admin/empresa");
    await page.getByTestId("input-settings-telefone").fill(updatedPhone);
    const saveSettingsResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/empresa") &&
        response.request().method() === "PATCH",
    );
    await page.getByTestId("button-submit-settings").click();
    expect((await saveSettingsResponse).ok()).toBeTruthy();

    const updatedResponse = await page.context().request.get("/api/admin/empresa");
    expect(updatedResponse.ok()).toBeTruthy();
    const updatedEmpresa = await updatedResponse.json();
    expect(updatedEmpresa?.telefone).toBe(updatedPhone);

    await page.context().request.patch("/api/admin/empresa", {
      data: { telefone: originalEmpresa?.telefone ?? null },
    });
  });

  test("lead sync writes and reads both directions with Odoo", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);

    const authResponse = await page.context().request.get("/api/auth/me");
    const authUser = await authResponse.json();
    const empresaId = authUser?.empresaId as string | undefined;
    expect(empresaId).toBeTruthy();

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    const originalEmpresa = await originalResponse.json();
    const enableResponse = await page.context().request.patch("/api/admin/empresa", {
      data: { crmLeadsEnabled: true, odooCrmEnabled: true },
    });
    expect(enableResponse.ok()).toBeTruthy();

    const [entitiesResponse, contactsResponse] = await Promise.all([
      page.context().request.get("/api/entidades"),
      page.context().request.get("/api/contactos"),
    ]);
    const entities = await entitiesResponse.json();
    const contacts = await contactsResponse.json();
    const entity = (Array.isArray(entities) ? entities : []).find(
      (item: any) => item?.odooPartnerId,
    );
    const contact = (Array.isArray(contacts) ? contacts : []).find(
      (item: any) => item?.entidadeId === entity?.id,
    );

    test.skip(
      !entity || !contact || !empresaId,
      "Requires an entity linked to Odoo with a contact.",
    );

    const marker = Date.now();
    let localLeadId: string | undefined;
    let odooLeadId: number | undefined;
    let importedContactToDelete: string | undefined;

    try {
      const createResponse = await page.context().request.post("/api/crm/leads", {
        data: {
          titulo: `E2E APP ${marker}`,
          entidadeId: entity.id,
          contactoId: contact.id,
          estado: "novo",
        },
      });
      expect(createResponse.status()).toBe(201);
      localLeadId = (await createResponse.json())?.lead?.id;
      expect(localLeadId).toBeTruthy();

      const firstSync = await page.context().request.post(
        `/api/crm/leads/${localLeadId}/odoo/sync`,
        { data: { forceAppToOdoo: true } },
      );
      expect(firstSync.ok()).toBeTruthy();
      odooLeadId = Number((await firstSync.json())?.odooLeadId);
      expect(odooLeadId).toBeGreaterThan(0);

      const appTitle = `E2E APP UPDATED ${marker}`;
      const updateResponse = await page.context().request.patch(
        `/api/crm/leads/${localLeadId}`,
        { data: { titulo: appTitle } },
      );
      expect(updateResponse.ok()).toBeTruthy();
      const secondSync = await page.context().request.post(
        `/api/crm/leads/${localLeadId}/odoo/sync`,
        { data: { forceAppToOdoo: true } },
      );
      expect(secondSync.ok()).toBeTruthy();
      expect((await getOdooLeadById(empresaId, odooLeadId))?.name).toBe(appTitle);

      const leadTypeSettings = originalEmpresa?.uiSettings?.odoo;
      expect(leadTypeSettings?.leadTypeFieldVerified).toBe(true);
      expect(leadTypeSettings?.leadTypeFieldName).toBeTruthy();
      if (leadTypeSettings?.leadTypeFieldName) {
        const options = Array.isArray(leadTypeSettings.leadTypeFieldOptions)
          ? leadTypeSettings.leadTypeFieldOptions
          : [];
        if (leadTypeSettings.leadTypeFieldType === "selection") {
          expect(options.length).toBeGreaterThan(0);
        }
        const appLeadType =
          leadTypeSettings.leadTypeFieldType === "selection"
            ? options[0]?.label
            : `APP TYPE ${marker}`;
        expect(appLeadType).toBeTruthy();

        const typeUpdate = await page.context().request.patch(
          `/api/crm/leads/${localLeadId}`,
          { data: { tipoLead: appLeadType } },
        );
        expect(typeUpdate.ok()).toBeTruthy();
        const typeSync = await page.context().request.post(
          `/api/crm/leads/${localLeadId}/odoo/sync`,
          { data: { forceAppToOdoo: true } },
        );
        expect(typeSync.ok()).toBeTruthy();
        expect((await getOdooLeadById(empresaId, odooLeadId))?.tipoLead).toBe(
          appLeadType,
        );

        const odooLeadType =
          leadTypeSettings.leadTypeFieldType === "selection"
            ? options[1]?.label ?? options[0]?.label
            : `ODOO TYPE ${marker}`;
        await updateOdooLeadType(empresaId, odooLeadId, odooLeadType);
        const typePull = await page.context().request.post(
          `/api/crm/leads/${localLeadId}/odoo/pull`,
        );
        expect(typePull.ok()).toBeTruthy();
        const localTypeResponse = await page.context().request.get(
          `/api/crm/leads/${localLeadId}`,
        );
        expect((await localTypeResponse.json())?.lead?.tipoLead).toBe(
          odooLeadType,
        );
      }

      const odooTitle = `E2E ODOO UPDATED ${marker}`;
      await updateOdooLeadTitle(empresaId, odooLeadId, odooTitle);
      const pullResponse = await page.context().request.post(
        `/api/crm/leads/${localLeadId}/odoo/pull`,
      );
      expect(pullResponse.ok()).toBeTruthy();
      const localResponse = await page.context().request.get(
        `/api/crm/leads/${localLeadId}`,
      );
      expect((await localResponse.json())?.lead?.titulo).toBe(odooTitle);

      const remoteBeforeImport = await getOdooLeadById(empresaId, odooLeadId);
      expect(remoteBeforeImport?.partnerId).toBe(Number(entity.odooPartnerId));
      expect(remoteBeforeImport?.salespersonPartnerId).toBeGreaterThan(0);

      await db
        .delete(leads)
        .where(and(eq(leads.id, localLeadId), eq(leads.empresaId, empresaId)));
      localLeadId = undefined;

      const importResponse = await page.context().request.post(
        "/api/crm/leads/odoo/import",
        { data: { odooLeadId } },
      );
      expect(importResponse.ok()).toBeTruthy();
      const imported = await importResponse.json();
      localLeadId = imported.lead.id;
      if (imported.importedRelations.createdContacto) {
        importedContactToDelete = imported.lead.contactoId;
      }
      expect(imported.lead.entidadeId).toBe(entity.id);
      expect(imported.lead.contactoId).toBeTruthy();
      expect(imported.importedRelations.entidadeId).toBe(entity.id);

      const importedSeller = await db.query.contactos.findFirst({
        where: and(
          eq(contactos.id, imported.lead.contactoId),
          eq(contactos.empresaId, empresaId),
        ),
      });
      expect(importedSeller?.odooPartnerId).toBe(
        String(remoteBeforeImport?.salespersonPartnerId),
      );

      await page.goto(`/admin/leads/${localLeadId}`);
      await expect(page.locator('[role="combobox"]').nth(0)).toBeVisible();
      await expect(page.locator('[role="combobox"]').nth(1)).toBeVisible();

      const relationEdit = await page.context().request.patch(
        `/api/crm/leads/${localLeadId}`,
        {
          data: {
            entidadeId: entity.id,
            contactoId: contact.id,
            visitaId: null,
          },
        },
      );
      expect(relationEdit.ok()).toBeTruthy();
      const editedLead = (await relationEdit.json()).lead;
      expect(editedLead.entidadeId).toBe(entity.id);
      expect(editedLead.contactoId).toBe(contact.id);
    } finally {
      if (odooLeadId && empresaId) {
        await deleteOdooLeadById(empresaId, odooLeadId).catch(() => undefined);
      }
      if (localLeadId && empresaId) {
        await db
          .delete(leads)
          .where(and(eq(leads.id, localLeadId), eq(leads.empresaId, empresaId)));
      }
      if (importedContactToDelete && empresaId) {
        await db
          .delete(contactos)
          .where(
            and(
              eq(contactos.id, importedContactToDelete),
              eq(contactos.empresaId, empresaId),
            ),
          );
      }
      await page.context().request.patch("/api/admin/empresa", {
        data: {
          crmLeadsEnabled: !!originalEmpresa?.crmLeadsEnabled,
          odooCrmEnabled: !!originalEmpresa?.odooCrmEnabled,
        },
      });
    }
  });

  test("agent lead access follows Odoo followers and configured permissions", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await login(page);

    const authUser = await (
      await page.context().request.get("/api/auth/me")
    ).json();
    const empresaId = authUser?.empresaId as string | undefined;
    expect(empresaId).toBeTruthy();
    const originalEmpresa = await (
      await page.context().request.get("/api/admin/empresa")
    ).json();
    await page.context().request.patch("/api/admin/empresa", {
      data: { crmLeadsEnabled: true, odooCrmEnabled: true },
    });

    const entities = await (
      await page.context().request.get("/api/entidades")
    ).json();
    const contacts = await (
      await page.context().request.get("/api/contactos")
    ).json();
    const entity = (Array.isArray(entities) ? entities : []).find(
      (item: any) => item?.odooPartnerId,
    );
    const contact = (Array.isArray(contacts) ? contacts : []).find(
      (item: any) => item?.entidadeId === entity?.id,
    );
    test.skip(
      !entity || !contact || !empresaId,
      "Requires an entity linked to Odoo with a contact.",
    );

    const marker = Date.now();
    const agentId = `lead-agent-${marker}`;
    const agentEmail = `lead-agent-${marker}@example.invalid`;
    const password = `Agent-${marker}-Secure`;
    let followedLeadId: string | undefined;
    let hiddenLeadId: string | undefined;
    let odooLeadId: number | undefined;
    const agentContext = await browser.newContext({
      baseURL: "http://127.0.0.1:5001",
    });

    try {
      await db.insert(users).values({
        id: agentId,
        email: agentEmail,
        passwordHash: await hashPassword(password),
        role: "agent",
        empresaId,
        ativo: true,
        odooPartnerId: String(entity.odooPartnerId),
        odooLeadAccess: "propose",
        odooLeadCanViewChatter: true,
      });

      const followedResponse = await page.context().request.post(
        "/api/crm/leads",
        {
          data: {
            titulo: `Lead seguido ${marker}`,
            entidadeId: entity.id,
            contactoId: contact.id,
            estado: "novo",
          },
        },
      );
      expect(followedResponse.status()).toBe(201);
      followedLeadId = (await followedResponse.json()).lead.id;

      const syncResponse = await page.context().request.post(
        `/api/crm/leads/${followedLeadId}/odoo/sync`,
      );
      expect(syncResponse.ok()).toBeTruthy();
      odooLeadId = Number((await syncResponse.json()).odooLeadId);
      expect(odooLeadId).toBeGreaterThan(0);

      const hiddenResponse = await page.context().request.post(
        "/api/crm/leads",
        {
          data: {
            titulo: `Lead oculto ${marker}`,
            entidadeId: entity.id,
            contactoId: contact.id,
            estado: "novo",
          },
        },
      );
      hiddenLeadId = (await hiddenResponse.json()).lead.id;

      await db.insert(leadFollowers).values({
        empresaId,
        leadId: followedLeadId!,
        userId: agentId,
        odooPartnerId: String(entity.odooPartnerId),
        source: "app",
      });

      const loginResponse = await agentContext.request.post(
        "/api/auth/login",
        { data: { email: agentEmail, password } },
      );
      expect(loginResponse.ok()).toBeTruthy();

      const agentList = await (
        await agentContext.request.get("/api/crm/leads")
      ).json();
      expect(
        agentList.leads.some((lead: any) => lead.id === followedLeadId),
      ).toBeTruthy();
      expect(
        agentList.leads.some((lead: any) => lead.id === hiddenLeadId),
      ).toBeFalsy();
      const chatterResponse = await agentContext.request.get(
        `/api/crm/leads/${followedLeadId}/odoo/chatter`,
      );
      expect(chatterResponse.ok()).toBeTruthy();
      const initialChatter = await chatterResponse.json();
      expect(Array.isArray(initialChatter.messages)).toBeTruthy();
      expect(Array.isArray(initialChatter.recipients)).toBeTruthy();
      expect(initialChatter.canPublish).toBe(false);
      const deniedChatterPost = await agentContext.request.post(
        `/api/crm/leads/${followedLeadId}/odoo/chatter`,
        { data: { body: `Mensagem sem autorização ${marker}` } },
      );
      expect(deniedChatterPost.status()).toBe(403);
      const agentPage = await agentContext.newPage();
      await agentPage.goto("/leads");
      await expect(
        agentPage.getByTestId("button-agent-import-odoo-lead"),
      ).toBeVisible();
      await expect(agentPage.getByText(`Lead seguido ${marker}`)).toBeVisible();
      await expect(agentPage.getByText(`Lead oculto ${marker}`)).toHaveCount(0);

      const proposedTitle = `Proposta agente ${marker}`;
      const proposalResponse = await agentContext.request.patch(
        `/api/crm/leads/${followedLeadId}`,
        { data: { titulo: proposedTitle } },
      );
      expect(proposalResponse.status()).toBe(202);
      expect((await proposalResponse.json()).approvalRequired).toBe(true);

      const pending = await (
        await page.context().request.get(
          "/api/crm/leads/approvals?status=pending",
        )
      ).json();
      const request = pending.requests.find(
        (item: any) => item.leadId === followedLeadId,
      );
      expect(request).toBeTruthy();
      const approvalsResponse = page.waitForResponse(
        (response) =>
          response.url().includes("/api/crm/leads/approvals?status=pending") &&
          response.ok(),
        { timeout: 15_000 },
      );
      await page.goto("/admin/leads");
      await approvalsResponse;
      await expect(page.getByTestId("card-lead-approvals")).toBeVisible();
      await expect(
        page.getByTestId(`lead-approval-${request.id}`),
      ).toBeVisible();

      const correctionResponse = await page.context().request.patch(
        `/api/crm/leads/approvals/${request.id}`,
        {
          data: {
            action: "changes_requested",
            comment: "Confirme o nome comercial.",
          },
        },
      );
      expect(correctionResponse.ok()).toBeTruthy();
      const agentRequests = await (
        await agentContext.request.get("/api/crm/leads/approvals")
      ).json();
      expect(
        agentRequests.requests.some(
          (item: any) =>
            item.id === request.id &&
            item.status === "changes_requested" &&
            item.reviewComment === "Confirme o nome comercial.",
        ),
      ).toBeTruthy();
      await agentPage.reload();
      await expect(
        agentPage.getByText("Confirme o nome comercial."),
      ).toBeVisible();

      await db
        .update(users)
        .set({
          odooLeadAccess: "publish",
          odooLeadCanPublishChatter: true,
        })
        .where(eq(users.id, agentId));
      const chatterMessage = `Atualização Chatter agente ${marker}`;
      const chatterPost = await agentContext.request.post(
        `/api/crm/leads/${followedLeadId}/odoo/chatter`,
        { data: { body: chatterMessage } },
      );
      expect(chatterPost.status()).toBe(201);
      expect(Number((await chatterPost.json()).messageId)).toBeGreaterThan(0);
      const updatedChatter = await (
        await agentContext.request.get(
          `/api/crm/leads/${followedLeadId}/odoo/chatter`,
        )
      ).json();
      expect(updatedChatter.canPublish).toBe(true);
      expect(
        updatedChatter.messages.some((message: any) =>
          message.body?.includes(chatterMessage),
        ),
      ).toBeTruthy();

      const chatterPage = await agentContext.newPage();
      await chatterPage.goto(`/admin/leads/${followedLeadId}`);
      await expect(
        chatterPage.getByTestId("textarea-odoo-chatter-message"),
      ).toBeVisible({ timeout: 15_000 });
      await chatterPage
        .getByTestId("textarea-odoo-chatter-message")
        .fill(`Confirmação visual ${marker}`);
      await chatterPage.getByTestId("button-publish-odoo-chatter").click();
      await expect(
        chatterPage.getByText("Publicar esta mensagem no Odoo?"),
      ).toBeVisible();
      await expect(
        chatterPage.getByText(/poderão ser notificados/i),
      ).toBeVisible();
      await chatterPage.getByTestId("button-confirm-publish-odoo-chatter").click();
      await expect(chatterPage.getByText(`Confirmação visual ${marker}`)).toBeVisible({
        timeout: 20_000,
      });
      await chatterPage.close();

      const directTitle = `Publicado agente ${marker}`;
      const directUpdate = await agentContext.request.patch(
        `/api/crm/leads/${followedLeadId}`,
        { data: { titulo: directTitle } },
      );
      expect(directUpdate.ok()).toBeTruthy();
      expect((await directUpdate.json()).approvalRequired).not.toBe(true);
      const directSync = await agentContext.request.post(
        `/api/crm/leads/${followedLeadId}/odoo/sync`,
      );
      expect(directSync.ok()).toBeTruthy();
      expect((await directSync.json()).approvalRequired).not.toBe(true);
      expect((await getOdooLeadById(empresaId!, odooLeadId!))?.name).toBe(
        directTitle,
      );
    } finally {
      await agentContext.close();
      if (odooLeadId && empresaId) {
        await deleteOdooLeadById(empresaId, odooLeadId).catch(() => undefined);
      }
      if (followedLeadId) {
        await db
          .delete(leadApprovalRequests)
          .where(eq(leadApprovalRequests.leadId, followedLeadId));
      }
      if (followedLeadId || hiddenLeadId) {
        await db
          .delete(leads)
          .where(
            inArray(
              leads.id,
              [followedLeadId, hiddenLeadId].filter(
                (value): value is string => !!value,
              ),
            ),
          );
      }
      await db.delete(users).where(eq(users.id, agentId));
      await page.context().request.patch("/api/admin/empresa", {
        data: {
          crmLeadsEnabled: !!originalEmpresa?.crmLeadsEnabled,
          odooCrmEnabled: !!originalEmpresa?.odooCrmEnabled,
        },
      });
    }
  });

  test("tenant references from outside the company are rejected", async ({ page }) => {
    await login(page);
    const foreignId = "00000000-0000-4000-8000-000000000099";

    const entityResponse = await page.context().request.post("/api/entidades", {
      data: {
        nome: `Tenant guard ${Date.now()}`,
        entidadeTipoId: foreignId,
      },
    });
    expect(entityResponse.status()).toBe(400);

    const contactResponse = await page.context().request.post("/api/contactos", {
      data: {
        nome: `Tenant guard ${Date.now()}`,
        entidadeId: foreignId,
      },
    });
    expect(contactResponse.status()).toBe(400);

    const taskResponse = await page.context().request.post("/api/tarefas", {
      data: {
        titulo: `Tenant guard ${Date.now()}`,
        entidadeId: foreignId,
      },
    });
    expect(taskResponse.status()).toBe(400);

    const visitResponse = await page.context().request.post("/api/visitas", {
      data: {
        dataVisita: new Date().toISOString(),
        entidadeId: foreignId,
      },
    });
    expect(visitResponse.status()).toBe(400);
  });

  test("module catalog saves module toggles through admin empresa", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const originalLeadsEnabled = !!originalEmpresa?.crmLeadsEnabled;

    await page.goto("/admin/empresa");
    await page.getByTestId("button-section-apis-keys").click();
    await expect(page.getByTestId("card-module-catalog")).toBeVisible();

    await page.getByTestId("toggle-module-leads").click();
    const saveModulesResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/admin/empresa") &&
        response.request().method() === "PATCH",
    );
    await page.getByTestId("button-save-module-catalog").click();
    expect((await saveModulesResponse).ok()).toBeTruthy();

    const updatedResponse = await page.context().request.get("/api/admin/empresa");
    expect(updatedResponse.ok()).toBeTruthy();
    const updatedEmpresa = await updatedResponse.json();
    expect(updatedEmpresa?.crmLeadsEnabled).toBe(!originalLeadsEnabled);

    await page.context().request.patch("/api/admin/empresa", {
      data: { crmLeadsEnabled: originalLeadsEnabled },
    });
  });

  test("owner can invite a company user through the admin interface", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const unique = Date.now().toString(36);
    const invitedEmail = `ui-invite-${unique}@example.test`;

    try {
      await login(page);
      await page.goto("/admin/empresa");
      await page.getByTestId("tab-empresa-utilizadores").click({ force: true });
      await expect(page.getByTestId("input-user-email")).toBeVisible();
      await page.getByTestId("input-user-email").fill(invitedEmail);
      await page.getByTestId("input-user-firstName").fill("Utilizador");
      await page.getByTestId("input-user-lastName").fill("Convidado");
      const inviteResponsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/admin/utilizadores") &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-create-user").click();
      expect((await inviteResponsePromise).status()).toBe(201);
      await expect(page.getByTestId("button-open-invitation")).toBeVisible();

      const [invitedUser] = await db
        .select({
          id: users.id,
          acceptedAt: users.acceptedAt,
          isOwner: users.isOwner,
        })
        .from(users)
        .where(eq(users.email, invitedEmail))
        .limit(1);
      expect(invitedUser).toMatchObject({
        acceptedAt: null,
        isOwner: false,
      });
      await expect(
        page.getByTestId(`badge-user-pending-${invitedUser.id}`),
      ).toBeVisible();
    } finally {
      await db.delete(users).where(eq(users.email, invitedEmail));
    }
  });

  test("commercial license is read-only and limits company modules", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();

    await page.goto("/admin/empresa");
    await page.getByTestId("button-section-apis-keys").click();
    await expect(page.getByTestId("card-plan-pro")).toBeVisible();
    await expect(page.getByTestId("badge-license-plan")).toContainText(
      /Licença contratada/i,
    );
    await expect(page.locator('[data-testid^="button-apply-plan-"]')).toHaveCount(0);

    try {
      await db
        .update(empresas)
        .set({ licensePlan: "base" })
        .where(eq(empresas.id, originalEmpresa.id));
      const unavailableModuleResponse = await page.context().request.patch(
        "/api/admin/empresa",
        { data: { crmLeadsEnabled: true } },
      );
      expect(unavailableModuleResponse.status()).toBe(403);
      expect(await unavailableModuleResponse.json()).toMatchObject({
        moduleId: "leads",
      });
    } finally {
      await db
        .update(empresas)
        .set({ licensePlan: originalEmpresa.licensePlan || "enterprise" })
        .where(eq(empresas.id, originalEmpresa.id));
    }
  });

  test("disabled leads module hides route access as well as navigation", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();

    await page.context().request.patch("/api/admin/empresa", {
      data: { crmLeadsEnabled: false },
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("nav-leads")).toHaveCount(0);

    await page.goto("/leads");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/404 Page Not Found/i);

    await page.context().request.patch("/api/admin/empresa", {
      data: { crmLeadsEnabled: originalEmpresa?.crmLeadsEnabled ?? false },
    });
  });

  test("disabled odoo contacts module blocks contact request APIs cleanly", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();

    await page.context().request.patch("/api/admin/empresa", {
      data: {
        odooContactsFeatureEnabled: false,
        odooContactsAdminEnabled: false,
        odooContactsAgentsEnabled: false,
      },
    });

    const blockedResponse = await page.context().request.get("/api/odoo/contact-requests/my");
    expect(blockedResponse.status()).toBe(403);
    const blockedPayload = await blockedResponse.json();
    expect(blockedPayload?.notEnabled).toBe(true);
    expect(blockedPayload?.moduleId).toBe("odoo_contacts");

    await page.goto("/admin/odoo-contact-requests");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toContainText(/404 Page Not Found/i);

    await page.context().request.patch("/api/admin/empresa", {
      data: {
        odooContactsFeatureEnabled: originalEmpresa?.odooContactsFeatureEnabled ?? false,
        odooContactsAdminEnabled: originalEmpresa?.odooContactsAdminEnabled ?? true,
        odooContactsAgentsEnabled: originalEmpresa?.odooContactsAgentsEnabled ?? false,
      },
    });
  });

  test("disabled ai module blocks ai APIs with module response instead of server error", async ({ page }) => {
    await login(page);

    const originalResponse = await page.context().request.get("/api/admin/empresa");
    expect(originalResponse.ok()).toBeTruthy();
    const originalEmpresa = await originalResponse.json();
    const originalUiSettings = originalEmpresa?.uiSettings ?? {};

    await page.context().request.patch("/api/admin/empresa", {
      data: {
        uiSettings: {
          ...originalUiSettings,
          enableIA: false,
          ia: {
            ...(originalUiSettings?.ia ?? {}),
            aiEnabled: false,
          },
        },
      },
    });

    const blockedResponse = await page.context().request.post("/api/ai/dashboard-insights", {
      data: { scope: "empresa", metrics: { totalVisitas: 3 } },
    });
    expect(blockedResponse.status()).toBe(403);
    const blockedPayload = await blockedResponse.json();
    expect(blockedPayload?.notEnabled).toBe(true);
    expect(blockedPayload?.moduleId).toBe("ai");

    await page.context().request.patch("/api/admin/empresa", {
      data: {
        uiSettings: originalUiSettings,
      },
    });
  });

  test("entity detail actions navigate without failures", async ({ page }) => {
    const suffix = Date.now().toString();
    const entityName = `ZZ Detail Entidade ${suffix}`;
    const entityPhone = `+351 93${suffix.slice(-7)}`;
    const entityEmail = `zz-detail-${suffix}@example.com`;

    await login(page);

    const entityResponse = await page.context().request.post("/api/entidades", {
      data: {
        nome: entityName,
        tipoEntidade: "Gabinete",
        telefone: entityPhone,
        email: entityEmail,
      },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const entity = await entityResponse.json();

    const contactResponse = await page.context().request.post("/api/contactos", {
      data: {
        nome: `ZZ Detail Contacto ${suffix}`,
        entidadeId: entity.id,
      },
    });
    expect(contactResponse.ok()).toBeTruthy();
    const contact = await contactResponse.json();

    await page.goto(`/entidades/${entity.id}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("link-telefone")).toContainText(entityPhone);
    await expect(page.getByTestId("link-email")).toContainText(entityEmail);

    await page.getByTestId("button-editar").click();
    await expect(page).toHaveURL(new RegExp(`/entidades/${entity.id}/editar$`));

    await page.goto(`/entidades/${entity.id}`);
    await page.getByTestId("button-novo-contacto").click();
    await expect(page).toHaveURL(new RegExp(`/contactos/novo\\?entidadeId=${entity.id}$`));

    await page.goto(`/entidades/${entity.id}`);
    await page.getByTestId("button-nova-visita").click();
    await expect(page).toHaveURL(new RegExp(`/visitas/nova\\?entidadeId=${entity.id}$`));

    await page.context().request.delete(`/api/contactos/${contact.id}`);
    await page.context().request.delete(`/api/entidades/${entity.id}`);
  });

  test("administrator creates and updates an entity in Odoo from its detail", async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = Date.now().toString();
    const entityName = `ZZ Odoo Entidade ${suffix}`;
    const updatedName = `${entityName} Atualizada`;
    let entityId: string | undefined;
    let partnerId: number | undefined;
    let empresaId: string | undefined;

    await login(page);
    const meResponse = await page.context().request.get("/api/auth/me");
    const me = await meResponse.json();
    empresaId = me?.empresaId;

    try {
      const entityResponse = await page.context().request.post("/api/entidades", {
        data: { nome: entityName, email: `zz-odoo-${suffix}@example.com` },
      });
      expect(entityResponse.ok()).toBeTruthy();
      const entity = await entityResponse.json();
      entityId = entity.id;

      await page.goto(`/entidades/${entity.id}`);
      await expect(page.getByText("Odoo", { exact: true })).toBeVisible();
      await expect(page.getByTestId("button-odoo-open-search")).toBeVisible();
      await page.getByTestId("button-odoo-create-partner").click();
      await expect(page.getByTestId("dialog-create-odoo-partner")).toBeVisible();

      const createResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/integrations/odoo/sync/entidades/${entity.id}/push`) &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-confirm-create-odoo-partner").click();
      expect((await createResponse).ok()).toBeTruthy();
      await expect(page.getByTestId("button-odoo-update-partner")).toBeVisible();

      const linkedResponse = await page.context().request.get(`/api/entidades/${entity.id}`);
      const linkedEntity = await linkedResponse.json();
      partnerId = Number(linkedEntity.odooPartnerId);
      expect(partnerId).toBeGreaterThan(0);

      const updateLocalResponse = await page.context().request.patch(`/api/entidades/${entity.id}`, {
        data: { nome: updatedName },
      });
      expect(updateLocalResponse.ok()).toBeTruthy();

      const updateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/integrations/odoo/sync/entidades/${entity.id}/push`) &&
          response.request().method() === "POST",
      );
      await page.getByTestId("button-odoo-update-partner").click();
      expect((await updateResponse).ok()).toBeTruthy();

      const partner = await getOdooPartnerById(empresaId!, partnerId);
      expect(partner?.name).toBe(updatedName);
    } finally {
      if (empresaId && partnerId) {
        await deleteOdooPartnerById(empresaId, partnerId).catch(() => undefined);
      }
      if (entityId) {
        await page.context().request.delete(`/api/entidades/${entityId}`);
      }
    }
  });

  test("visit detail creates task and supports edit navigation", async ({ page }) => {
    const suffix = Date.now().toString();
    const entityName = `ZZ Detail Visita Entidade ${suffix}`;
    const taskTitle = `ZZ Tarefa da Visita ${suffix}`;

    await login(page);

    const entityResponse = await page.context().request.post("/api/entidades", {
      data: { nome: entityName, tipoEntidade: "Gabinete" },
    });
    expect(entityResponse.ok()).toBeTruthy();
    const entity = await entityResponse.json();

    const visitResponse = await page.context().request.post("/api/visitas", {
      multipart: {
        entidadeId: entity.id,
        dataVisita: new Date().toISOString(),
        notas: "Visita de detalhe para validar ações.",
        contactosIds: "[]",
        marcasIds: "[]",
      },
    });
    expect(visitResponse.ok()).toBeTruthy();
    const visit = await visitResponse.json();

    await page.goto(`/visitas/${visit.id}`);
    await page.waitForLoadState("networkidle");

    await page.getByTestId("button-editar").click();
    await expect(page).toHaveURL(new RegExp(`/visitas/${visit.id}/editar$`));

    await page.goto(`/visitas/${visit.id}`);
    await page.getByTestId("button-criar-tarefa").click();
    await page.getByTestId("input-titulo").fill(taskTitle);
    await page.getByTestId("button-save").click();
    await expect(page.getByText(taskTitle)).toBeVisible();

    const tasksResponse = await page.context().request.get("/api/tarefas");
    expect(tasksResponse.ok()).toBeTruthy();
    const tasks = await tasksResponse.json();
    const createdTask = Array.isArray(tasks)
      ? tasks.find((task: any) => task?.titulo === taskTitle && task?.visitaId === visit.id)
      : null;
    expect(createdTask?.id).toBeTruthy();

    await page.context().request.delete(`/api/tarefas/${createdTask.id}`);
    await page.context().request.delete(`/api/visitas/${visit.id}`);
    await page.context().request.delete(`/api/entidades/${entity.id}`);
  });

  test("task detail exposes odoo sync actions without runtime failures", async ({ page }) => {
    const suffix = Date.now().toString();
    const taskTitle = `ZZ Odoo UI Tarefa ${suffix}`;

    await login(page);

    const taskResponse = await page.context().request.post("/api/tarefas", {
      data: {
        titulo: taskTitle,
        descricao:
          '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Checklist UI</p></div></li></ul>',
        status: "pending",
        repeatInterval: "none",
      },
    });
    expect(taskResponse.ok()).toBeTruthy();
    const task = await taskResponse.json();

    await page.goto(`/tarefas/${task.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByTestId("card-odoo-task")).toBeVisible();
    await expect(
      page.getByTestId(task.odooTaskId ? "button-tarefa-sincronizar-odoo" : "button-tarefa-criar-odoo"),
    ).toBeVisible();
    await expect(page.getByTestId("button-export-planner")).toHaveCount(0);
    await expect(page.getByTestId("dialog-planner-export")).toHaveCount(0);
    await expect(page.getByText("Microsoft Planner", { exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);

    await page.context().request.delete(`/api/tarefas/${task.id}`);
  });
});

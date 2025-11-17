import { db } from './db';
import { lembretes, entidades, visitas, tarefas, users } from '@shared/schema';
import { eq, and, sql, desc, lt, gte, inArray, or } from 'drizzle-orm';
import type { User } from '@shared/schema';

export interface ReminderContext {
  userId: string;
  userRole: 'admin' | 'agent';
}

export interface GeneratedReminder {
  userId: string;
  entidadeId?: string;
  visitaId?: string;
  tarefaId?: string;
  tipo: 'visita_followup' | 'tarefa_overdue' | 'ai_suggestion';
  mensagem: string;
  dataVencimento?: Date;
}

/**
 * Generate visit follow-up reminders for entities that haven't been visited in 7+ days
 * 
 * RBAC Logic:
 * - Admins: See reminders for all entities
 * - Agents: See reminders only for entities assigned to them (entidades.assignedUserId)
 * 
 * Note: When an entity is assigned to an agent, they have access to ALL visits for that entity,
 * even if created by other users. This is intentional - entity assignment conveys full access
 * to the entity's visit history, necessary for effective follow-up workflows.
 */
export async function generateVisitReminders(context: ReminderContext): Promise<GeneratedReminder[]> {
  const reminders: GeneratedReminder[] = [];
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Filter entities by RBAC: agents see only their assigned entities
  // CRITICAL: Filter entities BEFORE leftJoin to prevent RBAC leakage
  const filteredEntidades = context.userRole === 'agent'
    ? await db.select().from(entidades).where(eq(entidades.assignedUserId, context.userId))
    : await db.select().from(entidades);

  const entidadeIds = filteredEntidades.map(e => e.id);
  
  if (entidadeIds.length === 0) {
    return reminders; // No entities to process
  }

  // Now fetch visits for these filtered entities
  const entidadesData = await db
    .select({
      entidade: entidades,
      lastVisit: visitas,
    })
    .from(entidades)
    .leftJoin(visitas, eq(visitas.entidadeId, entidades.id))
    .where(inArray(entidades.id, entidadeIds))
    .orderBy(desc(visitas.dataVisita));

  const entidadeMap = new Map<string, { entidade: typeof entidades.$inferSelect; lastVisitDate?: Date }>();
  
  for (const row of entidadesData) {
    if (!entidadeMap.has(row.entidade.id)) {
      entidadeMap.set(row.entidade.id, {
        entidade: row.entidade,
        lastVisitDate: row.lastVisit?.dataVisita || undefined,
      });
    }
  }

  for (const [entidadeId, data] of Array.from(entidadeMap.entries())) {
    const { entidade, lastVisitDate } = data;

    if (!lastVisitDate || lastVisitDate < sevenDaysAgo) {
      const daysSince = lastVisitDate
        ? Math.floor((Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const mensagem = lastVisitDate
        ? `Já passaram ${daysSince} dias desde a última visita a ${entidade.nome}. Pretende agendar uma nova visita?`
        : `Ainda não existem visitas registadas para ${entidade.nome}. Pretende agendar uma visita?`;

      reminders.push({
        userId: context.userId,
        entidadeId: entidade.id,
        tipo: 'visita_followup',
        mensagem,
      });
    }

    let pendingTasksQuery = db
      .select()
      .from(tarefas)
      .where(
        and(
          eq(tarefas.entidadeId, entidade.id),
          eq(tarefas.status, 'pending')
        )
      )
      .$dynamic();

    if (context.userRole === 'agent') {
      pendingTasksQuery = pendingTasksQuery.where(
        eq(tarefas.assignedUserId, context.userId)
      );
    }

    const pendingTasks = await pendingTasksQuery;

    if (pendingTasks.length > 0) {
      const futureVisits = await db
        .select()
        .from(visitas)
        .where(
          and(
            eq(visitas.entidadeId, entidade.id),
            gte(visitas.dataVisita, new Date())
          )
        );

      if (futureVisits.length === 0) {
        reminders.push({
          userId: context.userId,
          entidadeId: entidade.id,
          tipo: 'visita_followup',
          mensagem: `Existem ${pendingTasks.length} tarefa(s) pendente(s) para ${entidade.nome} sem visita agendada. Deseja criar follow-up?`,
        });
      }
    }

    const recentVisitsWithSummary = await db
      .select()
      .from(visitas)
      .where(
        and(
          eq(visitas.entidadeId, entidade.id),
          sql`${visitas.resumoIa} IS NOT NULL`
        )
      )
      .orderBy(desc(visitas.dataVisita))
      .limit(1);

    if (recentVisitsWithSummary.length > 0) {
      const visit = recentVisitsWithSummary[0];
      if (visit.resumoIa && (visit.resumoIa.includes('próxima') || visit.resumoIa.includes('seguimento') || visit.resumoIa.includes('follow-up'))) {
        reminders.push({
          userId: context.userId,
          entidadeId: entidade.id,
          visitaId: visit.id,
          tipo: 'ai_suggestion',
          mensagem: `A IA sugeriu um follow-up para ${entidade.nome} com base na última visita. Deseja criar tarefa ou agendar visita?`,
        });
      }
    }
  }

  return reminders;
}

export async function generateTaskReminders(context: ReminderContext): Promise<GeneratedReminder[]> {
  const reminders: GeneratedReminder[] = [];
  const now = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // For agents, filter tasks to show only those:
  // 1. Assigned to the agent (assignedUserId), OR
  // 2. Belonging to entities assigned to the agent (entidadeId)
  // CRITICAL: Separate queries to prevent inArray([]) from leaking data
  let tasks;
  if (context.userRole === 'agent') {
    // Get agent's assigned entities
    const agentEntidades = await db
      .select()
      .from(entidades)
      .where(eq(entidades.assignedUserId, context.userId));
    
    const agentEntidadeIds = agentEntidades.map(e => e.id);

    // Fetch tasks directly assigned to agent
    const directlyAssignedTasks = await db
      .select()
      .from(tarefas)
      .where(
        and(
          eq(tarefas.status, 'pending'),
          eq(tarefas.assignedUserId, context.userId)
        )
      );

    // Fetch tasks from agent's entities (only if agent has entities)
    let entityTasks = [];
    if (agentEntidadeIds.length > 0) {
      entityTasks = await db
        .select()
        .from(tarefas)
        .where(
          and(
            eq(tarefas.status, 'pending'),
            inArray(tarefas.entidadeId, agentEntidadeIds)
          )
        );
    }

    // Combine and deduplicate tasks
    const taskMap = new Map();
    for (const task of [...directlyAssignedTasks, ...entityTasks]) {
      taskMap.set(task.id, task);
    }
    tasks = Array.from(taskMap.values());
  } else {
    // Admins see all pending tasks
    tasks = await db
      .select()
      .from(tarefas)
      .where(eq(tarefas.status, 'pending'));
  }

  for (const task of tasks) {
    if (task.dueDate) {
      if (task.dueDate < now) {
        const daysOverdue = Math.floor((now.getTime() - task.dueDate.getTime()) / (1000 * 60 * 60 * 24));
        reminders.push({
          userId: context.userId,
          tarefaId: task.id,
          tipo: 'tarefa_overdue',
          mensagem: `A tarefa "${task.titulo}" está atrasada (${daysOverdue} dia(s)). Reagendar?`,
          dataVencimento: task.dueDate,
        });
      } else if (task.dueDate <= tomorrow) {
        reminders.push({
          userId: context.userId,
          tarefaId: task.id,
          tipo: 'tarefa_overdue',
          mensagem: `A tarefa "${task.titulo}" vence amanhã. Deseja antecipar ou preparar follow-up?`,
          dataVencimento: task.dueDate,
        });
      }
    }

    if (task.updatedAt && task.updatedAt < sevenDaysAgo) {
      reminders.push({
        userId: context.userId,
        tarefaId: task.id,
        tipo: 'tarefa_overdue',
        mensagem: `A tarefa "${task.titulo}" não tem atividade há ${Math.floor((now.getTime() - task.updatedAt.getTime()) / (1000 * 60 * 60 * 24))} dias. Quer atualizá-la?`,
      });
    }
  }

  return reminders;
}

export async function generateAIReminders(context: ReminderContext): Promise<GeneratedReminder[]> {
  const reminders: GeneratedReminder[] = [];
  return reminders;
}

export async function generateAllReminders(user: User): Promise<number> {
  const context: ReminderContext = {
    userId: user.id,
    userRole: user.role,
  };

  const existingActive = await db
    .select()
    .from(lembretes)
    .where(
      and(
        eq(lembretes.userId, user.id),
        eq(lembretes.resolved, false),
        sql`(${lembretes.snoozedUntil} IS NULL OR ${lembretes.snoozedUntil} <= NOW())`
      )
    );

  const visitReminders = await generateVisitReminders(context);
  const taskReminders = await generateTaskReminders(context);

  const allReminders = [...visitReminders, ...taskReminders];

  const existingSet = new Set(
    existingActive.map((r) => `${r.tipo}-${r.entidadeId || ''}-${r.visitaId || ''}-${r.tarefaId || ''}`)
  );

  const newReminders = allReminders.filter((r: GeneratedReminder) => {
    const key = `${r.tipo}-${r.entidadeId || ''}-${r.visitaId || ''}-${r.tarefaId || ''}`;
    return !existingSet.has(key);
  });

  if (newReminders.length > 0) {
    await db.insert(lembretes).values(newReminders);
  }

  return newReminders.length;
}

export async function snoozeReminder(reminderId: string, snoozeDuration: '2days' | '7days' | '30days'): Promise<void> {
  const snoozedUntil = new Date();
  
  switch (snoozeDuration) {
    case '2days':
      snoozedUntil.setDate(snoozedUntil.getDate() + 2);
      break;
    case '7days':
      snoozedUntil.setDate(snoozedUntil.getDate() + 7);
      break;
    case '30days':
      snoozedUntil.setDate(snoozedUntil.getDate() + 30);
      break;
  }

  await db
    .update(lembretes)
    .set({ snoozedUntil })
    .where(eq(lembretes.id, reminderId));
}

export async function resolveReminder(reminderId: string): Promise<void> {
  await db
    .update(lembretes)
    .set({
      resolved: true,
      resolvedAt: new Date(),
    })
    .where(eq(lembretes.id, reminderId));
}

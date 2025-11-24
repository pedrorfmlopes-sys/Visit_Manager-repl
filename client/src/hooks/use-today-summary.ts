import { useQuery } from "@tanstack/react-query";
import type { Visita, Tarefa } from "@shared/schema";
import { isToday, isBefore, startOfDay, endOfDay } from "date-fns";

interface TodaySummary {
  tarefasPendentes: number;
  tarefasAtrasadas: number;
  tarefasHoje: number;
  visitasHoje: number;
  totalAlerts: number;
  isLoading: boolean;
}

export function useTodaySummary(): TodaySummary {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // Fetch all pending tasks
  const { data: tarefas = [], isLoading: tarefasLoading } = useQuery<Tarefa[]>({
    queryKey: ["/api/tarefas", { status: "pending" }],
    refetchInterval: 120000, // 2 minutes
  });

  // Fetch visits for today
  const { data: visitasData = [], isLoading: visitasLoading } = useQuery<
    Visita[]
  >({
    queryKey: ["/api/visitas", { from: todayStart, to: todayEnd }],
    refetchInterval: 120000, // 2 minutes
  });

  // Calculate counts
  let tarefasAtrasadas = 0;
  let tarefasHoje = 0;

  tarefas.forEach((tarefa) => {
    if (tarefa.status === "pending" && tarefa.dueDate) {
      const dueDate = new Date(tarefa.dueDate);

      // Overdue if dueDate is before today
      if (isBefore(dueDate, todayStart)) {
        tarefasAtrasadas++;
      }

      // Due today if dueDate is today
      if (isToday(dueDate)) {
        tarefasHoje++;
      }
    }
  });

  const tarefasPendentes = tarefas.filter(
    (t) => t.status === "pending"
  ).length;
  const visitasHoje = visitasData.filter((v) => {
    const visitaDate = new Date(v.dataVisita);
    return isToday(visitaDate);
  }).length;

  const totalAlerts =
    tarefasAtrasadas + (tarefasAtrasadas === 0 ? tarefasHoje : 0) + visitasHoje;

  return {
    tarefasPendentes,
    tarefasAtrasadas,
    tarefasHoje,
    visitasHoje,
    totalAlerts,
    isLoading: tarefasLoading || visitasLoading,
  };
}

import { AlertCircle, Calendar } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useTodaySummary } from "@/hooks/use-today-summary";

export function AlertRibbon() {
  const { tarefasAtrasadas, tarefasHoje, visitasHoje } = useTodaySummary();

  // Determine what alert to show (priority: overdue > today tasks > visits today)
  let alertMessage = "";
  let alertIcon = null;
  let alertLink = "/tarefas";

  if (tarefasAtrasadas > 0) {
    alertMessage = `Tens ${tarefasAtrasadas} tarefa${tarefasAtrasadas > 1 ? "s" : ""} em atraso`;
    alertIcon = AlertCircle;
  } else if (tarefasHoje > 0) {
    alertMessage = `Tens ${tarefasHoje} tarefa${tarefasHoje > 1 ? "s" : ""} para hoje`;
    alertIcon = Calendar;
  } else if (visitasHoje > 0) {
    alertMessage = `Tens ${visitasHoje} visita${visitasHoje > 1 ? "s" : ""} marcada${visitasHoje > 1 ? "s" : ""} para hoje`;
    alertIcon = Calendar;
  }

  if (!alertMessage) {
    return null;
  }

  const Icon = alertIcon || AlertCircle;
  const alertColor = tarefasAtrasadas > 0 ? "bg-destructive/10" : "bg-accent/10";
  const textColor = tarefasAtrasadas > 0 ? "text-destructive" : "text-accent";

  return (
    <div className={`${alertColor} border-b border-destructive/20 sticky top-0 z-30`}>
      <div className="flex items-center justify-between px-4 py-3 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 flex-shrink-0 ${textColor}`} />
          <span className={`text-sm font-medium ${textColor}`}>{alertMessage}</span>
        </div>
        <Link href={alertLink}>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            data-testid="button-alert-ribbon-action"
          >
            Ver
          </Button>
        </Link>
      </div>
    </div>
  );
}

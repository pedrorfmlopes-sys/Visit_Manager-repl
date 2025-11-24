import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

interface PerformanceData {
  period: { from: Date; to: Date };
  metrics: {
    visitasRealizadas: number;
    visitasAgendadas: number;
    tarefasCriadas: number;
    tarefasConcluidas: number;
    tarefasEmAtraso: number;
    percentagemAtraso: number;
    clientesChave: Array<{ nome: string; visitCount: number; ultimaVisita?: string }>;
    tarefasEmAtrasoDetalhes: Array<{ titulo: string; diasAtraso: number }>;
    marcasMaisTrabalhadas: Array<{ marca: string; count: number }>;
  };
  insights: string;
  empresa: { nome: string; logoUrl?: string };
  user?: { nome: string; email: string };
  scope: 'agent' | 'empresa';
}

class PerformanceProDocument {
  private doc: jsPDF;
  public yPosition: number = 20;
  private readonly lineHeight: number = 5;
  private readonly pageWidth: number;
  private readonly marginLeft: number = 15;
  private readonly marginRight: number = 15;
  private readonly maxWidth: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.maxWidth = this.pageWidth - this.marginLeft - this.marginRight;
  }

  checkPageBreak(spaceNeeded: number = 20): void {
    if (this.yPosition + spaceNeeded > 270) {
      this.doc.addPage();
      this.yPosition = 15;
    }
  }

  addText(text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]): void {
    const sanitized = text
      .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    this.doc.setFontSize(fontSize);
    this.doc.setTextColor(color[0], color[1], color[2]);

    if (isBold) {
      this.doc.setFont("helvetica", "bold");
    } else {
      this.doc.setFont("helvetica", "normal");
    }

    const lines = this.doc.splitTextToSize(sanitized, this.maxWidth);
    lines.forEach((line: string) => {
      this.checkPageBreak();
      this.doc.text(line, this.marginLeft, this.yPosition);
      this.yPosition += this.lineHeight;
    });
    this.doc.setTextColor(0, 0, 0);
  }

  addTitle(title: string): void {
    this.checkPageBreak(20);
    this.addText(title, 22, true, [0, 51, 102]);
    this.yPosition += 5;
  }

  addSubtitle(subtitle: string): void {
    this.addText(subtitle, 12, false, [100, 100, 100]);
    this.yPosition += 3;
  }

  addSectionHeader(title: string): void {
    this.checkPageBreak(12);
    this.yPosition += 2;
    this.doc.setFillColor(240, 245, 250);
    this.doc.rect(this.marginLeft, this.yPosition - 4, this.maxWidth, 7, 'F');
    this.addText(title, 11, true, [0, 51, 102]);
    this.yPosition += 1;
  }

  addDivider(): void {
    this.yPosition += 2;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.marginLeft, this.yPosition, this.pageWidth - this.marginRight, this.yPosition);
    this.yPosition += 3;
  }

  addKPIRow(label: string, value: string | number, unit: string = ''): void {
    this.checkPageBreak(6);
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);

    this.doc.text(label, this.marginLeft, this.yPosition);
    const valueStr = `${value}${unit ? ' ' + unit : ''}`;
    this.doc.text(valueStr, this.pageWidth - this.marginRight - 20, this.yPosition, { align: 'right' });
    this.yPosition += this.lineHeight;
  }

  addTable(headers: string[], rows: string[][]): void {
    this.checkPageBreak(rows.length * 5 + 10);
    const colWidth = this.maxWidth / headers.length;
    const rowHeight = 5;

    // Headers
    this.doc.setFillColor(0, 51, 102);
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(9);

    headers.forEach((header, idx) => {
      this.doc.text(header, this.marginLeft + idx * colWidth + 1, this.yPosition + 3, { maxWidth: colWidth - 2 });
    });

    this.yPosition += rowHeight;

    // Rows
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont("helvetica", "normal");
    rows.forEach((row) => {
      row.forEach((cell, idx) => {
        this.doc.text(String(cell), this.marginLeft + idx * colWidth + 1, this.yPosition + 3, { maxWidth: colWidth - 2 });
      });
      this.yPosition += rowHeight;
    });
  }

  getBuffer(): Buffer {
    return this.doc.output('arraybuffer') as any as Buffer;
  }
}

export async function generatePerformanceProPDF(data: PerformanceData): Promise<Buffer> {
  const doc = new PerformanceProDocument();

  // Cover
  doc.addTitle('Relatório PRO de Performance Comercial');
  doc.yPosition += 3;
  doc.addSubtitle(`Empresa: ${data.empresa.nome}`);
  if (data.user && data.scope === 'agent') {
    doc.addSubtitle(`Agente: ${data.user.nome}`);
  }
  doc.addSubtitle(`Período: ${format(data.period.from, 'd MMMM yyyy', { locale: pt })} a ${format(data.period.to, 'd MMMM yyyy', { locale: pt })}`);
  doc.addDivider();
  doc.yPosition += 5;

  // Section 1: KPIs
  doc.addSectionHeader('KPIs do Período');
  doc.yPosition += 2;
  doc.addKPIRow('Visitas Realizadas', data.metrics.visitasRealizadas);
  doc.addKPIRow('Visitas Agendadas (próx. 7 dias)', data.metrics.visitasAgendadas);
  doc.addKPIRow('Tarefas Criadas', data.metrics.tarefasCriadas);
  doc.addKPIRow('Tarefas Concluídas', data.metrics.tarefasConcluidas);
  doc.addKPIRow('Tarefas em Atraso', data.metrics.tarefasEmAtraso, `(${data.metrics.percentagemAtraso.toFixed(1)}%)`);
  doc.yPosition += 3;

  // Section 2: Top Clients
  if (data.metrics.clientesChave.length > 0) {
    doc.addSectionHeader('Top Entidades / Clientes');
    doc.yPosition += 2;

    const tableRows = data.metrics.clientesChave.slice(0, 5).map((c) => [
      c.nome.substring(0, 30),
      String(c.visitCount),
      c.ultimaVisita || '-'
    ]);

    doc.addTable(['Entidade', 'Visitas', 'Última Visita'], tableRows);
    doc.yPosition += 3;
  }

  // Section 3: Overdue Tasks
  if (data.metrics.tarefasEmAtrasoDetalhes.length > 0) {
    doc.addSectionHeader('Tarefas em Atraso');
    doc.yPosition += 2;

    const tableRows = data.metrics.tarefasEmAtrasoDetalhes.slice(0, 5).map((t) => [
      t.titulo.substring(0, 35),
      `${t.diasAtraso} dias`
    ]);

    doc.addTable(['Tarefa', 'Dias de Atraso'], tableRows);
    doc.yPosition += 3;
  }

  // Section 4: AI Insights
  doc.addSectionHeader('Análise IA de Desempenho');
  doc.yPosition += 2;
  doc.addText(data.insights, 9, false, [0, 0, 0]);
  doc.yPosition += 5;

  // Footer
  doc.addDivider();
  doc.addText(`Relatório gerado em ${format(new Date(), 'd MMM yyyy HH:mm', { locale: pt })}`, 8, false, [150, 150, 150]);
  doc.addText('Dados extraídos automaticamente do Visit Manager', 7, false, [180, 180, 180]);

  return doc.getBuffer();
}

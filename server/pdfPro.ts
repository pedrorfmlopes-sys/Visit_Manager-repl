import { jsPDF } from "jspdf";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { pt } from "date-fns/locale";
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';

interface PdfOptions {
  includePhotos?: boolean;
  includeTasks?: boolean;
  includeIA?: boolean;
  includeCharts?: boolean;
  type?: 'interno' | 'cliente';
}

const chartRenderer = new ChartJSNodeCanvas({ width: 800, height: 400, backgroundColour: 'white' });

export function sanitizePDFText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

export async function renderChartToImage(config: ChartConfiguration): Promise<Buffer> {
  try {
    return await chartRenderer.renderToBuffer(config);
  } catch (error) {
    console.error('Error rendering chart:', error);
    throw error;
  }
}

export async function generatePdfAISummary(
  type: 'executivo' | 'relacao_comercial' | 'proximos_passos' | 'pontos_criticos' | 'oportunidades',
  data: any,
  openaiClient: any
): Promise<string> {
  const prompts = {
    executivo: `Gera um resumo executivo profissional em português de Portugal para este relatório de visitas comerciais. Foca-se em KPIs, resultados e tendências. Máximo 150 palavras. SEM EMOJIS.

Dados: ${JSON.stringify(data)}`,
    
    relacao_comercial: `Analisa a relação comercial com esta entidade de forma profissional em português de Portugal. Identifica o estado da relação, frequência de contacto, e nível de engagement. Máximo 120 palavras. SEM EMOJIS.

Dados: ${JSON.stringify(data)}`,
    
    proximos_passos: `Lista 3-5 próximos passos recomendados para esta entidade/cliente, baseado no histórico de visitas e tarefas. Português de Portugal, formato de lista profissional. SEM EMOJIS.

Dados: ${JSON.stringify(data)}`,
    
    pontos_criticos: `Identifica 2-4 pontos críticos que requerem atenção imediata nesta relação comercial. Português de Portugal, tom profissional. Máximo 100 palavras. SEM EMOJIS.

Dados: ${JSON.stringify(data)}`,
    
    oportunidades: `Identifica 2-4 oportunidades de venda ou aprofundamento da relação comercial. Português de Portugal, foco em ações concretas. Máximo 120 palavras. SEM EMOJIS.

Dados: ${JSON.stringify(data)}`
  };

  try {
    const completion = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'És um assistente especializado em análise comercial B2B em Portugal. Respondes sempre em português de Portugal, de forma profissional e concisa, SEM USAR EMOJIS.' },
        { role: 'user', content: prompts[type] }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || 'Análise não disponível.';
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return 'Análise IA não disponível no momento.';
  }
}

class PDFProDocument {
  private doc: jsPDF;
  private yPosition: number = 20;
  private readonly lineHeight: number = 7;
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
    if (this.yPosition + spaceNeeded > 280) {
      this.doc.addPage();
      this.yPosition = 20;
    }
  }

  addText(text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]): void {
    const sanitized = sanitizePDFText(text);
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

  addSectionHeader(title: string, color: [number, number, number] = [0, 51, 102]): void {
    this.checkPageBreak(15);
    this.yPosition += 3;
    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(this.marginLeft, this.yPosition - 5, this.maxWidth, 8, 'F');
    this.addText(title, 12, true, color);
    this.yPosition += 2;
  }

  addDivider(): void {
    this.yPosition += 2;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.marginLeft, this.yPosition, this.pageWidth - this.marginRight, this.yPosition);
    this.yPosition += 5;
  }

  async addImage(imageUrl: string, width: number = 40, height: number = 40, align: 'left' | 'right' | 'center' = 'center'): Promise<void> {
    try {
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      
      const mimeType = response.headers.get('content-type');
      if (!mimeType?.includes('png') && !mimeType?.includes('jpeg') && !mimeType?.includes('jpg')) {
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const format = mimeType.includes('png') ? 'PNG' : 'JPEG';
      const dataUrl = `data:${mimeType};base64,${base64}`;
      
      this.checkPageBreak(height + 5);
      
      let xPosition = this.marginLeft;
      if (align === 'center') {
        xPosition = (this.pageWidth - width) / 2;
      } else if (align === 'right') {
        xPosition = this.pageWidth - this.marginRight - width;
      }
      
      this.doc.addImage(dataUrl, format, xPosition, this.yPosition, width, height);
      this.yPosition += height + 5;
    } catch (error) {
      console.error('Error adding image:', error);
    }
  }

  async addChart(chartConfig: ChartConfiguration, width: number = 180, height: number = 90): Promise<void> {
    try {
      const imageBuffer = await renderChartToImage(chartConfig);
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;
      
      this.checkPageBreak(height + 10);
      const xPosition = (this.pageWidth - width) / 2;
      this.doc.addImage(dataUrl, 'PNG', xPosition, this.yPosition, width, height);
      this.yPosition += height + 10;
    } catch (error) {
      console.error('Error adding chart:', error);
      this.addText('Gráfico não disponível', 9, false, [150, 150, 150]);
    }
  }

  addTable(headers: string[], rows: string[][], columnWidths?: number[]): void {
    this.checkPageBreak(50);
    
    const defaultColumnWidths = headers.map(() => this.maxWidth / headers.length);
    const widths = columnWidths || defaultColumnWidths;
    
    this.doc.setFillColor(240, 240, 240);
    this.doc.setDrawColor(180, 180, 180);
    
    let currentX = this.marginLeft;
    headers.forEach((header, index) => {
      this.doc.rect(currentX, this.yPosition - 5, widths[index], 7, 'FD');
      this.doc.setFontSize(9);
      this.doc.setFont("helvetica", "bold");
      this.doc.text(sanitizePDFText(header), currentX + 2, this.yPosition);
      currentX += widths[index];
    });
    
    this.yPosition += 5;
    
    rows.forEach((row) => {
      this.checkPageBreak(10);
      currentX = this.marginLeft;
      
      row.forEach((cell, index) => {
        this.doc.rect(currentX, this.yPosition - 5, widths[index], 7, 'D');
        this.doc.setFontSize(8);
        this.doc.setFont("helvetica", "normal");
        const cellText = sanitizePDFText(cell || '-');
        const truncated = cellText.length > 30 ? cellText.substring(0, 27) + '...' : cellText;
        this.doc.text(truncated, currentX + 2, this.yPosition);
        currentX += widths[index];
      });
      
      this.yPosition += 7;
    });
    
    this.yPosition += 5;
  }

  addPageNumber(): void {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(150, 150, 150);
      this.doc.text(
        `Página ${i} de ${pageCount}`,
        this.pageWidth / 2,
        this.doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
  }

  getBuffer(): Buffer {
    this.addPageNumber();
    return Buffer.from(this.doc.output('arraybuffer'));
  }

  getCurrentY(): number {
    return this.yPosition;
  }

  setY(y: number): void {
    this.yPosition = y;
  }

  addSpace(space: number = 5): void {
    this.yPosition += space;
  }
}

export async function generateVisitaPDFPro(
  visita: any,
  entidade: any,
  contacto: any,
  tarefas: any[],
  recentVisits: any[],
  options: PdfOptions,
  openaiClient: any
): Promise<Buffer> {
  const pdf = new PDFProDocument();
  
  if (entidade?.logoUrl && options.includePhotos !== false) {
    await pdf.addImage(entidade.logoUrl, 30, 30, 'right');
  }
  
  pdf.addText("Relatório de Visita PRO", 20, true, [0, 51, 102]);
  pdf.addText(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt }), 9, false, [100, 100, 100]);
  pdf.addDivider();
  
  pdf.addSectionHeader("Identificação da Visita");
  pdf.addText(`Data: ${format(new Date(visita.dataVisita), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt })}`, 10, true);
  pdf.addText(`Entidade: ${entidade?.nome || 'N/A'}`, 10, true);
  if (entidade?.tipoEntidade) {
    pdf.addText(`Tipo: ${entidade.tipoEntidade}`);
  }
  if (contacto) {
    pdf.addText(`Contacto: ${contacto.nome}${contacto.cargo ? ` - ${contacto.cargo}` : ''}`);
  }
  pdf.addDivider();
  
  if (entidade) {
    pdf.addSectionHeader("Dados da Entidade");
    if (entidade.nif) pdf.addText(`NIF: ${entidade.nif}`, 10, true);
    if (entidade.morada) pdf.addText(`Morada: ${entidade.morada}`);
    if (entidade.cidade) pdf.addText(`Cidade: ${entidade.cidade}`);
    if (entidade.telefone) pdf.addText(`Telefone: ${entidade.telefone}`);
    if (entidade.email) pdf.addText(`Email: ${entidade.email}`);
    if (entidade.website) pdf.addText(`Website: ${entidade.website}`, 9, false, [0, 0, 255]);
    pdf.addDivider();
  }
  
  if (visita.notas) {
    pdf.addSectionHeader("Notas da Visita");
    pdf.addText(visita.notas);
    pdf.addDivider();
  }
  
  if (visita.resumoIa && options.includeIA !== false) {
    pdf.addSectionHeader("Resumo IA");
    pdf.addText(visita.resumoIa);
    pdf.addDivider();
  }
  
  if (visita.transcricaoAudio && options.type === 'interno') {
    pdf.addSectionHeader("Transcrição do Áudio");
    pdf.addText(visita.transcricaoAudio, 8);
    pdf.addDivider();
  }
  
  if (visita.marcasEntregues && visita.marcasEntregues.length > 0) {
    pdf.addSectionHeader("Marcas Entregues");
    visita.marcasEntregues.forEach((marca: string) => {
      pdf.addText(`• ${marca}`, 10);
    });
    pdf.addDivider();
  }
  
  if (tarefas.length > 0 && options.includeTasks !== false) {
    pdf.addSectionHeader("Tarefas Associadas");
    const tableData = tarefas.map(t => [
      t.titulo,
      t.status || 'pendente',
      t.dueDate ? format(new Date(t.dueDate), 'dd/MM/yyyy', { locale: pt }) : '-'
    ]);
    pdf.addTable(['Tarefa', 'Estado', 'Data'], tableData);
  }
  
  if (visita.gpsLatitude && visita.gpsLongitude) {
    pdf.addSectionHeader("Localização GPS");
    pdf.addText(`Coordenadas: ${visita.gpsLatitude}, ${visita.gpsLongitude}`);
    pdf.addText(`Ver no mapa: https://www.google.com/maps?q=${visita.gpsLatitude},${visita.gpsLongitude}`, 8, false, [0, 0, 255]);
    pdf.addDivider();
  }
  
  if (visita.fotos && visita.fotos.length > 0 && options.includePhotos !== false) {
    pdf.addSectionHeader("Fotografias");
    for (const foto of visita.fotos.slice(0, 3)) {
      await pdf.addImage(foto, 160, 120, 'center');
    }
  }
  
  if (recentVisits.length > 0 && options.includeCharts !== false) {
    pdf.addSectionHeader("Histórico de Visitas");
    const tableData = recentVisits.slice(0, 5).map((v: any) => [
      format(new Date(v.dataVisita), 'dd/MM/yyyy', { locale: pt }),
      v.notas ? v.notas.substring(0, 50) + '...' : '-',
      v.marcasEntregues?.join(', ') || '-'
    ]);
    pdf.addTable(['Data', 'Notas', 'Marcas'], tableData, [40, 80, 60]);
  }
  
  if (options.includeIA !== false && options.type === 'interno') {
    pdf.addSectionHeader("Ações Recomendadas (IA)");
    const aiRecommendations = await generatePdfAISummary('proximos_passos', {
      entidade: entidade?.nome,
      visita: visita.notas,
      tarefas: tarefas.length,
      historico: recentVisits.length
    }, openaiClient);
    pdf.addText(aiRecommendations);
  }
  
  return pdf.getBuffer();
}

export async function generateEntidadePDFPro(
  entidade: any,
  contactos: any[],
  visitas: any[],
  tarefas: any[],
  options: PdfOptions,
  openaiClient: any
): Promise<Buffer> {
  const pdf = new PDFProDocument();
  
  if (entidade?.logoUrl && options.includePhotos !== false) {
    await pdf.addImage(entidade.logoUrl, 35, 35, 'right');
  }
  
  pdf.addText("Relatório da Entidade PRO", 20, true, [0, 51, 102]);
  pdf.addText(format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt }), 9, false, [100, 100, 100]);
  pdf.addDivider();
  
  pdf.addSectionHeader("Identificação");
  pdf.addText(entidade.nome || 'Sem nome', 14, true);
  if (entidade.tipoEntidade) pdf.addText(`Tipo: ${entidade.tipoEntidade}`, 10, true);
  if (entidade.nif) pdf.addText(`NIF: ${entidade.nif}`);
  if (entidade.morada) pdf.addText(`Morada: ${entidade.morada}`);
  if (entidade.cidade) pdf.addText(`Cidade: ${entidade.cidade}`);
  if (entidade.codigoPostal) pdf.addText(`Código Postal: ${entidade.codigoPostal}`);
  if (entidade.telefone) pdf.addText(`Telefone: ${entidade.telefone}`);
  if (entidade.email) pdf.addText(`Email: ${entidade.email}`);
  if (entidade.website) pdf.addText(`Website: ${entidade.website}`, 9, false, [0, 0, 255]);
  pdf.addDivider();
  
  if (contactos.length > 0) {
    pdf.addSectionHeader("Contactos");
    const tableData = contactos.map(c => [
      c.nome,
      c.cargo || '-',
      c.telefone || c.email || '-'
    ]);
    pdf.addTable(['Nome', 'Cargo', 'Contacto'], tableData, [60, 50, 70]);
  }
  
  if (visitas.length > 0) {
    pdf.addSectionHeader(`Histórico de Visitas (${visitas.length} total)`);
    const tableData = visitas.slice(0, 10).map(v => [
      format(new Date(v.dataVisita), 'dd/MM/yyyy', { locale: pt }),
      v.contacto?.nome || '-',
      v.marcasEntregues?.join(', ') || '-'
    ]);
    pdf.addTable(['Data', 'Contacto', 'Marcas'], tableData, [35, 60, 85]);
    
    if (options.includeCharts !== false && visitas.length > 1) {
      pdf.addSectionHeader("Evolução de Visitas por Mês");
      
      const visitsByMonth: Record<string, number> = {};
      visitas.forEach(v => {
        const month = format(new Date(v.dataVisita), 'MM/yyyy', { locale: pt });
        visitsByMonth[month] = (visitsByMonth[month] || 0) + 1;
      });
      
      const labels = Object.keys(visitsByMonth).slice(-6);
      const data = labels.map(l => visitsByMonth[l]);
      
      const chartConfig: ChartConfiguration = {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Visitas',
            data,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Visitas por Mês' }
          }
        }
      };
      
      await pdf.addChart(chartConfig);
    }
  }
  
  if (tarefas.length > 0 && options.includeTasks !== false) {
    pdf.addSectionHeader(`Tarefas (${tarefas.length} total)`);
    
    const pendentes = tarefas.filter(t => t.status !== 'concluída').length;
    const concluídas = tarefas.filter(t => t.status === 'concluída').length;
    
    pdf.addText(`Pendentes: ${pendentes} | Concluídas: ${concluídas}`, 10, true);
    pdf.addSpace();
    
    const tableData = tarefas.slice(0, 10).map(t => [
      t.titulo,
      t.status || 'pendente',
      t.dueDate ? format(new Date(t.dueDate), 'dd/MM/yyyy', { locale: pt }) : '-'
    ]);
    pdf.addTable(['Tarefa', 'Estado', 'Prazo'], tableData, [90, 40, 50]);
    
    if (options.includeCharts !== false) {
      pdf.addSectionHeader("Distribuição de Tarefas");
      
      const chartConfig: ChartConfiguration = {
        type: 'pie',
        data: {
          labels: ['Pendentes', 'Concluídas'],
          datasets: [{
            data: [pendentes, concluídas],
            backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: 'Estado das Tarefas' }
          }
        }
      };
      
      await pdf.addChart(chartConfig, 150, 100);
    }
  }
  
  const allMarcas: string[] = [];
  visitas.forEach(v => {
    if (v.marcasEntregues) {
      allMarcas.push(...v.marcasEntregues);
    }
  });
  
  if (allMarcas.length > 0 && options.includeCharts !== false) {
    pdf.addSectionHeader("Marcas Mais Entregues");
    
    const marcasCount: Record<string, number> = {};
    allMarcas.forEach(m => {
      marcasCount[m] = (marcasCount[m] || 0) + 1;
    });
    
    const sortedMarcas = Object.entries(marcasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    
    const chartConfig: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: sortedMarcas.map(m => m[0]),
        datasets: [{
          label: 'Quantidade',
          data: sortedMarcas.map(m => m[1]),
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top 8 Marcas' }
        }
      }
    };
    
    await pdf.addChart(chartConfig, 180, 100);
  }
  
  if (options.includeIA !== false && options.type === 'interno') {
    pdf.addSectionHeader("Análise da Relação Comercial (IA)");
    const aiAnalysis = await generatePdfAISummary('relacao_comercial', {
      entidade: entidade.nome,
      visitas: visitas.length,
      tarefas: tarefas.length,
      ultimaVisita: visitas[0]?.dataVisita
    }, openaiClient);
    pdf.addText(aiAnalysis);
    pdf.addDivider();
    
    pdf.addSectionHeader("Próximos Passos Recomendados (IA)");
    const aiNextSteps = await generatePdfAISummary('proximos_passos', {
      entidade: entidade.nome,
      historico: visitas.length,
      tarefasPendentes: tarefas.filter(t => t.status !== 'concluída').length
    }, openaiClient);
    pdf.addText(aiNextSteps);
    
    if (options.type === 'interno') {
      pdf.addDivider();
      pdf.addSectionHeader("Oportunidades Identificadas (IA)");
      const aiOpportunities = await generatePdfAISummary('oportunidades', {
        entidade: entidade.nome,
        marcas: allMarcas
      }, openaiClient);
      pdf.addText(aiOpportunities);
    }
  }
  
  return pdf.getBuffer();
}

export async function generateMonthlyReportPDF(
  period: { start: Date; end: Date },
  visitas: any[],
  tarefas: any[],
  entidades: any[],
  userId: string,
  userRole: string,
  options: PdfOptions,
  openaiClient: any
): Promise<Buffer> {
  const pdf = new PDFProDocument();
  
  const isWeekly = (period.end.getTime() - period.start.getTime()) < 10 * 24 * 60 * 60 * 1000;
  const reportType = isWeekly ? 'Semanal' : 'Mensal';
  
  pdf.addText(`Relatório ${reportType} PRO`, 20, true, [0, 51, 102]);
  pdf.addText(
    `Período: ${format(period.start, 'dd/MM/yyyy', { locale: pt })} - ${format(period.end, 'dd/MM/yyyy', { locale: pt })}`,
    10,
    false,
    [100, 100, 100]
  );
  pdf.addText(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: pt })}`, 9, false, [150, 150, 150]);
  pdf.addDivider();
  
  pdf.addSectionHeader("Indicadores Principais (KPIs)");
  pdf.addText(`Total de Visitas: ${visitas.length}`, 12, true);
  pdf.addText(`Total de Tarefas: ${tarefas.length}`, 12, true);
  pdf.addText(`Entidades Visitadas: ${new Set(visitas.map(v => v.entidadeId)).size}`, 12, true);
  
  const tarefasConcluidas = tarefas.filter(t => t.status === 'concluída').length;
  const taxaConclusao = tarefas.length > 0 ? ((tarefasConcluidas / tarefas.length) * 100).toFixed(1) : '0';
  pdf.addText(`Taxa de Conclusão de Tarefas: ${taxaConclusao}%`, 12, true);
  
  pdf.addDivider();
  
  if (options.includeCharts !== false && visitas.length > 0) {
    pdf.addSectionHeader("Evolução de Visitas no Período");
    
    const visitsByDay: Record<string, number> = {};
    visitas.forEach(v => {
      const day = format(new Date(v.dataVisita), 'dd/MM', { locale: pt });
      visitsByDay[day] = (visitsByDay[day] || 0) + 1;
    });
    
    const labels = Object.keys(visitsByDay);
    const data = labels.map(l => visitsByDay[l]);
    
    const chartConfig: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Visitas',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 2,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Visitas por Dia' }
        }
      }
    };
    
    await pdf.addChart(chartConfig);
  }
  
  if (visitas.length > 0) {
    pdf.addSectionHeader("Resumo de Visitas");
    const tableData = visitas.slice(0, 15).map(v => [
      format(new Date(v.dataVisita), 'dd/MM', { locale: pt }),
      v.entidade?.nome || '-',
      v.contacto?.nome || '-',
      v.marcasEntregues?.slice(0, 2).join(', ') || '-'
    ]);
    pdf.addTable(['Data', 'Entidade', 'Contacto', 'Marcas'], tableData, [25, 60, 50, 45]);
  }
  
  if (tarefas.length > 0 && options.includeTasks !== false) {
    pdf.addSectionHeader("Resumo de Tarefas");
    const tableData = tarefas.slice(0, 15).map(t => [
      t.titulo.substring(0, 40),
      t.status || 'pendente',
      t.dueDate ? format(new Date(t.dueDate), 'dd/MM', { locale: pt }) : '-'
    ]);
    pdf.addTable(['Tarefa', 'Estado', 'Prazo'], tableData, [100, 40, 40]);
  }
  
  const allMarcas: string[] = [];
  visitas.forEach(v => {
    if (v.marcasEntregues) {
      allMarcas.push(...v.marcasEntregues);
    }
  });
  
  if (allMarcas.length > 0 && options.includeCharts !== false) {
    pdf.addSectionHeader("Marcas Mais Utilizadas no Período");
    
    const marcasCount: Record<string, number> = {};
    allMarcas.forEach(m => {
      marcasCount[m] = (marcasCount[m] || 0) + 1;
    });
    
    const sortedMarcas = Object.entries(marcasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    
    const chartConfig: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: sortedMarcas.map(m => m[0]),
        datasets: [{
          data: sortedMarcas.map(m => m[1]),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Distribuição de Marcas' }
        }
      }
    };
    
    await pdf.addChart(chartConfig, 150, 120);
  }
  
  if (options.includeIA !== false) {
    pdf.addSectionHeader(`Análise Executiva do ${reportType} (IA)`);
    const aiExecutive = await generatePdfAISummary('executivo', {
      periodo: `${format(period.start, 'dd/MM', { locale: pt })} - ${format(period.end, 'dd/MM', { locale: pt })}`,
      visitas: visitas.length,
      tarefas: tarefas.length,
      taxaConclusao,
      marcasPrincipais: Object.entries(allMarcas.reduce((acc: Record<string, number>, m) => {
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3).map(m => m[0])
    }, openaiClient);
    pdf.addText(aiExecutive);
  }
  
  return pdf.getBuffer();
}

export { PDFProDocument };

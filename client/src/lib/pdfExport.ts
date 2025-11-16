import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import type { VisitaWithRelations } from "@shared/schema";

/**
 * Sanitize text for PDF by removing non-printable characters
 */
function sanitizePDFText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control chars
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n');
}

/**
 * Generate PDF report for a visit
 */
export function generateVisitPDF(visita: VisitaWithRelations): void {
  const doc = new jsPDF();
  let yPosition = 20;
  const lineHeight = 7;
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = 15;
  const maxWidth = pageWidth - marginLeft - marginRight;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    const sanitized = sanitizePDFText(text);
    doc.setFontSize(fontSize);
    if (isBold) {
      doc.setFont("helvetica", "bold");
    } else {
      doc.setFont("helvetica", "normal");
    }
    
    const lines = doc.splitTextToSize(sanitized, maxWidth);
    lines.forEach((line: string) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, marginLeft, yPosition);
      yPosition += lineHeight;
    });
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Visita", marginLeft, yPosition);
  yPosition += 12;

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(format(new Date(visita.dataVisita), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt }), marginLeft, yPosition);
  yPosition += 10;

  // Line separator
  doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
  yPosition += 8;

  // Office info
  if (visita.gabinete) {
    addText("Gabinete", 14, true);
    yPosition += 2;
    addText(visita.gabinete.nome, 12, true);
    if (visita.gabinete.morada) {
      addText(`Morada: ${visita.gabinete.morada}`);
    }
    if (visita.gabinete.telefone) {
      addText(`Telefone: ${visita.gabinete.telefone}`);
    }
    if (visita.gabinete.email) {
      addText(`Email: ${visita.gabinete.email}`);
    }
    yPosition += 5;
  }

  // Contact info
  if (visita.contacto) {
    addText("Contacto", 14, true);
    yPosition += 2;
    addText(visita.contacto.nome, 11, true);
    if (visita.contacto.funcao) {
      addText(`Função: ${visita.contacto.funcao}`);
    }
    if (visita.contacto.telemovel) {
      addText(`Telemóvel: ${visita.contacto.telemovel}`);
    }
    if (visita.contacto.email) {
      addText(`Email: ${visita.contacto.email}`);
    }
    yPosition += 5;
  }

  // Notes
  if (visita.notas) {
    addText("Notas da Visita", 14, true);
    yPosition += 2;
    addText(visita.notas);
    yPosition += 5;
  }

  // AI Summary
  if (visita.resumoIa) {
    addText("Resumo da IA", 14, true);
    yPosition += 2;
    addText(visita.resumoIa);
    yPosition += 5;
  }

  // Audio transcription
  if (visita.transcricaoAudio) {
    addText("Transcrição de Áudio", 14, true);
    yPosition += 2;
    addText(visita.transcricaoAudio);
    yPosition += 5;
  }

  // Brands delivered
  if (visita.marcasEntregues && visita.marcasEntregues.length > 0) {
    addText("Marcas Entregues", 14, true);
    yPosition += 2;
    addText(visita.marcasEntregues.join(", "));
    yPosition += 5;
  }

  // GPS Location
  if (visita.latitude && visita.longitude) {
    addText("Localização GPS", 14, true);
    yPosition += 2;
    addText(`Latitude: ${visita.latitude}`);
    addText(`Longitude: ${visita.longitude}`);
    if (visita.locationAccuracy) {
      addText(`Precisão: ${visita.locationAccuracy}m`);
    }
    yPosition += 5;
  }

  // Next visit
  if (visita.proximaVisita) {
    addText("Próxima Visita Agendada", 14, true);
    yPosition += 2;
    addText(format(new Date(visita.proximaVisita), "PPP 'às' HH:mm", { locale: pt }));
    yPosition += 5;
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128, 128, 128);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}`, marginLeft, footerY);
  doc.text("Visitas Comerciais PWA", pageWidth - marginRight, footerY, { align: "right" });

  // Save PDF
  const fileName = `visita-${visita.gabinete?.nome?.replace(/\s/g, '-') || visita.id}-${format(new Date(visita.dataVisita), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}

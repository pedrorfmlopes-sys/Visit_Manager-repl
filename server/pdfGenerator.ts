import jsPDF from "jspdf";
import { format } from "date-fns";
import { pt } from "date-fns/locale";

// Set up canvas for jsPDF in Node.js environment
import { createCanvas, Image, ImageData } from "canvas";

// Complete DOM emulation for jsPDF in Node
if (typeof global !== 'undefined') {
  (global as any).Image = Image;
  (global as any).HTMLCanvasElement = createCanvas(0, 0).constructor;
  (global as any).HTMLImageElement = Image;
  (global as any).ImageData = ImageData;
  
  // Emulate document.createElement for canvas
  (global as any).document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return createCanvas(0, 0);
      }
      return {};
    }
  };
}

// Helper to fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

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
 * Generate comprehensive PDF report for a visit
 * Includes entidade details, enrichment data, tarefas, media, GPS, etc.
 */
export async function generateVisitaPDF(visita: any, tarefas: any[]): Promise<Uint8Array> {
  const doc = new jsPDF();
  let yPosition = 20;
  const lineHeight = 7;
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 15;
  const marginRight = 15;
  const maxWidth = pageWidth - marginLeft - marginRight;

  // Helper function to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
    const sanitized = sanitizePDFText(text);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    
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
    doc.setTextColor(0, 0, 0); // Reset color
  };

  const addSectionHeader = (title: string) => {
    yPosition += 3;
    doc.setFillColor(240, 240, 240);
    doc.rect(marginLeft, yPosition - 5, maxWidth, 8, 'F');
    addText(title, 12, true, [0, 51, 102]);
    yPosition += 2;
  };

  const addDivider = () => {
    yPosition += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(marginLeft, yPosition, pageWidth - marginRight, yPosition);
    yPosition += 5;
  };

  // ========== HEADER ==========
  const entidade = visita.entidade;
  
  // Helper to check if image format is supported by jsPDF in Node
  const isSupportedFormat = (mimeType: string | null, url: string): boolean => {
    const urlLower = url.toLowerCase();
    // jsPDF in Node only supports JPEG and PNG reliably
    if (mimeType) {
      if (mimeType.includes('png') || mimeType.includes('jpeg') || mimeType.includes('jpg')) return true;
      if (mimeType.includes('webp') || mimeType.includes('svg')) return false;
    }
    // Check URL extension
    return urlLower.endsWith('.png') || urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg');
  };

  // Helper to get image format from MIME type or URL
  const getImageFormat = (mimeType: string | null, url: string): string => {
    if (mimeType) {
      if (mimeType.includes('png')) return 'PNG';
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'JPEG';
    }
    // Fallback to URL extension
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.png')) return 'PNG';
    return 'JPEG'; // Default
  };

  // Try to load and display entidade logo
  let logoLoaded = false;
  if (entidade?.logoUrl) {
    try {
      // Load logo image with timeout (5 seconds max)
      const response = await fetchWithTimeout(entidade.logoUrl, 5000);
      if (response.ok) {
        const mimeType = response.headers.get('content-type');
        
        // Only process supported formats (PNG, JPEG)
        if (isSupportedFormat(mimeType, entidade.logoUrl)) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          const format = getImageFormat(mimeType, entidade.logoUrl);
          // Ensure proper MIME type for data URL
          const safeMimeType = mimeType || (format === 'PNG' ? 'image/png' : 'image/jpeg');
          const dataUrl = `data:${safeMimeType};base64,${base64}`;
          
          // Add logo image (30x30 size in top right)
          doc.addImage(dataUrl, format, pageWidth - marginRight - 30, yPosition, 30, 30);
          logoLoaded = true;
        } else {
          console.log(`Skipping unsupported logo format: ${mimeType || 'unknown'} for ${entidade.logoUrl}`);
        }
      }
    } catch (error) {
      console.error('Error loading entidade logo (timeout or fetch failed):', error);
      // Silently continue without logo if it fails
    }
  }

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 51, 102);
  doc.text("Relatório de Visita", marginLeft, yPosition);
  yPosition += 8;

  // Entity name and type
  if (entidade) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(entidade.nome || "Sem nome", marginLeft, yPosition);
    yPosition += 6;

    if (entidade.tipoEntidade) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(`Tipo: ${entidade.tipoEntidade}`, marginLeft, yPosition);
      yPosition += 5;
    }
  }

  // Visit date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(format(new Date(visita.dataVisita), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: pt }), marginLeft, yPosition);
  yPosition += 8;

  addDivider();

  // ========== SECTION 1: ENTIDADE DETAILS ==========
  if (entidade) {
    addSectionHeader("Detalhes da Entidade");

    if (entidade.nif) {
      addText(`NIF: ${entidade.nif}`, 10, true);
    }

    if (entidade.morada) {
      addText(`Morada: ${entidade.morada}`);
    }

    if (entidade.cidade && entidade.codigoPostal) {
      addText(`${entidade.codigoPostal} ${entidade.cidade}`);
    } else if (entidade.cidade) {
      addText(`Cidade: ${entidade.cidade}`);
    }

    if (entidade.telefone) {
      addText(`Telefone: ${entidade.telefone}`);
    }

    if (entidade.email) {
      addText(`Email: ${entidade.email}`);
    }

    if (entidade.website) {
      addText(`Website: ${entidade.website}`, 9, false, [0, 0, 255]);
    }

    // Enrichment data
    if (entidade.domain) {
      yPosition += 2;
      addText("Dados de Enriquecimento", 10, true);
      addText(`Domínio: ${entidade.domain}`, 9);
    }

    if (entidade.industry) {
      addText(`Indústria: ${entidade.industry}`, 9);
    }

    if (entidade.description) {
      yPosition += 2;
      addText("Descrição:", 9, true);
      addText(entidade.description, 9);
    }

    // Social links
    const hasSocial = entidade.linkedinUrl || entidade.facebookUrl || entidade.instagramUrl || entidade.twitterUrl;
    if (hasSocial) {
      yPosition += 2;
      addText("Redes Sociais:", 9, true);
      if (entidade.linkedinUrl) addText(`LinkedIn: ${entidade.linkedinUrl}`, 8, false, [0, 0, 255]);
      if (entidade.facebookUrl) addText(`Facebook: ${entidade.facebookUrl}`, 8, false, [0, 0, 255]);
      if (entidade.instagramUrl) addText(`Instagram: ${entidade.instagramUrl}`, 8, false, [0, 0, 255]);
      if (entidade.twitterUrl) addText(`Twitter/X: ${entidade.twitterUrl}`, 8, false, [0, 0, 255]);
    }

    yPosition += 3;
    addDivider();
  }

  // ========== SECTION 2: CONTACTO DETAILS ==========
  if (visita.contacto) {
    addSectionHeader("Contacto Principal");
    addText(visita.contacto.nome, 11, true);
    
    if (visita.contacto.funcao) {
      addText(`Função: ${visita.contacto.funcao}`);
    }
    if (visita.contacto.email) {
      addText(`Email: ${visita.contacto.email}`);
    }
    if (visita.contacto.telemovel) {
      addText(`Telemóvel: ${visita.contacto.telemovel}`);
    }
    if (visita.contacto.telefone) {
      addText(`Telefone: ${visita.contacto.telefone}`);
    }

    yPosition += 3;
    addDivider();
  }

  // ========== SECTION 3: VISIT INFORMATION ==========
  addSectionHeader("Informações da Visita");

  // Notes
  if (visita.notas) {
    addText("Notas:", 10, true);
    addText(visita.notas);
    yPosition += 3;
  }

  // AI Summary (highlighted)
  if (visita.resumoIa) {
    yPosition += 2;
    const summaryHeight = doc.splitTextToSize(sanitizePDFText(visita.resumoIa), maxWidth - 4).length * lineHeight + 10;
    
    // Check if summary would overflow page BEFORE drawing
    if (yPosition + summaryHeight > 280) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFillColor(255, 252, 230);
    doc.roundedRect(marginLeft - 2, yPosition - 3, maxWidth + 4, summaryHeight, 2, 2, 'F');
    
    addText("Resumo da IA", 10, true, [102, 51, 0]);
    addText(visita.resumoIa);
    yPosition += 3;
  }

  // Audio transcription
  if (visita.transcricaoAudio) {
    addText("Transcrição de Áudio:", 10, true);
    addText(visita.transcricaoAudio, 9);
    yPosition += 3;
  }

  // GPS Coordinates
  if (visita.latitude && visita.longitude) {
    addText("Localização GPS:", 10, true);
    addText(`Coordenadas: ${visita.latitude}, ${visita.longitude}`, 9);
    if (visita.locationAccuracy) {
      addText(`Precisão: ${visita.locationAccuracy}m`, 9);
    }
    yPosition += 3;
  }

  // Brands delivered
  if (visita.marcasEntregues && visita.marcasEntregues.length > 0) {
    addText("Marcas Entregues:", 10, true);
    addText(visita.marcasEntregues.join(", "), 9);
    yPosition += 3;
  }

  // Next visit
  if (visita.proximaVisita) {
    addText("Próxima Visita Agendada:", 10, true);
    addText(format(new Date(visita.proximaVisita), "PPP 'às' HH:mm", { locale: pt }), 9);
    yPosition += 3;
  }

  addDivider();

  // ========== SECTION 4: TAREFAS DESTA VISITA ==========
  if (tarefas && tarefas.length > 0) {
    addSectionHeader("Tarefas desta Visita");

    // Sort tarefas by due date
    const sortedTarefas = tarefas.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    sortedTarefas.forEach((tarefa, index) => {
      if (index > 0) yPosition += 4;

      // Status badge
      const statusText = tarefa.status === 'pending' ? 'Pendente' : 'Concluída';
      const statusColor: [number, number, number] = tarefa.status === 'pending' ? [255, 152, 0] : [76, 175, 80];
      
      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.setDrawColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(marginLeft, yPosition - 3, 25, 5, 1, 1, 'FD');
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(statusText, marginLeft + 12.5, yPosition, { align: 'center' });
      doc.setTextColor(0, 0, 0);
      yPosition += 5;

      addText(tarefa.titulo, 10, true);
      
      if (tarefa.descricao) {
        addText(tarefa.descricao, 9);
      }

      if (tarefa.dueDate) {
        addText(`Prazo: ${format(new Date(tarefa.dueDate), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}`, 9);
      }

      if (tarefa.assignedUserId) {
        addText(`Atribuída a: User ${tarefa.assignedUserId.substring(0, 8)}...`, 9);
      }
    });

    yPosition += 3;
    addDivider();
  }

  // ========== SECTION 5: MEDIA ==========
  const hasMedia = (visita.mediaUrls && visita.mediaUrls.length > 0) || visita.audioUrl;
  if (hasMedia) {
    addSectionHeader("Média");

    // Display photos (scaled images)
    if (visita.mediaUrls && visita.mediaUrls.length > 0) {
      const photos = visita.mediaUrls.filter((url: string) => 
        url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.webp')
      );
      
      const videos = visita.mediaUrls.filter((url: string) => 
        url.includes('.mp4') || url.includes('.webm') || url.includes('.mov')
      );

      // Render photos as embedded images
      if (photos.length > 0) {
        addText("Fotografias:", 10, true);
        
        for (const photoUrl of photos) {
          try {
            // Fetch photo with 5 second timeout
            const response = await fetchWithTimeout(photoUrl, 5000);
            if (response.ok) {
              const mimeType = response.headers.get('content-type');
              
              // Check if format is supported (PNG, JPEG only)
              if (isSupportedFormat(mimeType, photoUrl)) {
                // Use Node Buffer API instead of FileReader
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64 = buffer.toString('base64');
                const format = getImageFormat(mimeType, photoUrl);
                // Ensure proper MIME type for data URL
                const safeMimeType = mimeType || (format === 'PNG' ? 'image/png' : 'image/jpeg');
                const dataUrl = `data:${safeMimeType};base64,${base64}`;
                
                // Calculate scaled dimensions (max width: maxWidth, max height: 100)
                const maxImageWidth = maxWidth;
                const maxImageHeight = 100;
                const captionHeight = 8;
                const totalImageBlock = maxImageHeight + captionHeight + 5;
                
                // Check if we need a new page BEFORE adding image
                if (yPosition + totalImageBlock > 280) {
                  doc.addPage();
                  yPosition = 20;
                }
                
                // Add scaled image
                doc.addImage(dataUrl, format, marginLeft, yPosition, maxImageWidth, maxImageHeight);
                yPosition += maxImageHeight + 5;
                
                // Add caption
                doc.setFontSize(8);
                doc.setTextColor(100, 100, 100);
                doc.text(photoUrl.substring(photoUrl.lastIndexOf('/') + 1), marginLeft, yPosition);
                doc.setTextColor(0, 0, 0);
                yPosition += captionHeight;
              } else {
                // Unsupported format (WEBP, SVG, etc.) - add placeholder text
                addText(`📷 ${photoUrl.substring(photoUrl.lastIndexOf('/') + 1)} (formato não suportado)`, 8);
              }
            } else {
              // If fetch fails, add URL as text
              addText(`📷 ${photoUrl.substring(photoUrl.lastIndexOf('/') + 1)}`, 8);
            }
          } catch (error) {
            console.error('Error loading photo (timeout or fetch failed):', error);
            // Fallback: add URL as text
            addText(`📷 ${photoUrl.substring(photoUrl.lastIndexOf('/') + 1)}`, 8);
          }
        }
        
        yPosition += 2;
      }

      // List video links
      if (videos.length > 0) {
        addText("Vídeos:", 10, true);
        videos.forEach((url: string, index: number) => {
          addText(`🎥 Vídeo ${index + 1}: ${url}`, 8, false, [0, 0, 255]);
        });
        yPosition += 2;
      }

      // List other files
      const otherFiles = visita.mediaUrls.filter((url: string) => 
        !photos.includes(url) && !videos.includes(url)
      );
      if (otherFiles.length > 0) {
        addText("Outros Ficheiros:", 10, true);
        otherFiles.forEach((url: string, index: number) => {
          addText(`📎 Ficheiro ${index + 1}: ${url}`, 8);
        });
        yPosition += 2;
      }
    }

    // Audio file link
    if (visita.audioUrl) {
      addText("Áudio:", 10, true);
      addText(`🎵 ${visita.audioUrl}`, 8, false, [0, 0, 255]);
    }

    yPosition += 3;
  }

  // ========== FOOTER ==========
  const addFooter = (pageNum: number) => {
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128, 128, 128);
    doc.text(`Gerado por Divitek Visit Manager em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}`, marginLeft, footerY);
    doc.text(`Página ${pageNum}`, pageWidth - marginRight, footerY, { align: "right" });
  };

  // Add footer to all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i);
  }

  // Return PDF as Uint8Array (convert from ArrayBuffer)
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

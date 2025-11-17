import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Flashlight, FlashlightOff, X, Copy, Search, CheckCircle2, Camera, QrCode, CreditCard } from "lucide-react";
import { parseVCard, isVCard } from "@/lib/vcardParser";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { ContactCreationDialog } from "@/components/ContactCreationDialog";
import { queueVCardImport, queueVisionCardImport, getPendingVCardImports, updateVCardImportStatus, deleteVCardImport, getDeadVCardImports, clearDeadVCardImports, retryDeadVCardImport } from "@/lib/offlineQueue";

export default function QRScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastScanTime = useRef<number>(0);
  
  // Scanner mode
  const [scannerMode, setScannerMode] = useState<'qr' | 'businesscard'>('qr');
  
  // Contact creation dialog state
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [pendingContact, setPendingContact] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Business card capture state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Offline sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const prevOnlineStatus = useRef<boolean | null>(null);

  // Dead queue state
  const [deadItemsCount, setDeadItemsCount] = useState(0);

  // Check for dead items periodically
  useEffect(() => {
    const checkDeadItems = async () => {
      const deadItems = await getDeadVCardImports();
      setDeadItemsCount(deadItems.length);
    };

    checkDeadItems();
    const interval = setInterval(checkDeadItems, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-sync when connection is restored OR on initial mount if online
  useEffect(() => {
    // On initial mount (prevOnlineStatus is null) or when transitioning from offline to online
    if (isOnline && (prevOnlineStatus.current === null || !prevOnlineStatus.current)) {
      syncOfflineQueue();
    }
    prevOnlineStatus.current = isOnline;
  }, [isOnline]);

  const syncOfflineQueue = async () => {
    if (isSyncing) return;

    setIsSyncing(true);

    try {
      const pending = await getPendingVCardImports();

      if (pending.length === 0) {
        setIsSyncing(false);
        return;
      }

      toast({
        title: "A sincronizar",
        description: `A importar ${pending.length} cartão(ões) guardado(s)...`,
      });

      let successCount = 0;
      let failCount = 0;

      for (const item of pending) {
        try {
          await updateVCardImportStatus(item.id, 'syncing');

          let res: Response;
          if (item.type === 'vcard' && item.vcardData) {
            res = await apiRequest("POST", "/api/tools/vcard-import", item.vcardData);
          } else if (item.type === 'vision' && item.visionData) {
            res = await apiRequest("POST", "/api/tools/vision-card", item.visionData);
          } else {
            throw new Error("Invalid queue item type");
          }

          if (!res.ok) {
            throw new Error("Failed to import");
          }

          await deleteVCardImport(item.id);
          successCount++;
        } catch (error) {
          console.error("Error syncing item:", error);
          await updateVCardImportStatus(item.id, 'failed', String(error));
          failCount++;
        }
      }

      // Invalidate caches after sync if any succeeded
      if (successCount > 0) {
        await queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      }

      // Always show completion toast with summary
      toast({
        title: "Sincronização completa",
        description: successCount > 0 
          ? `${successCount} cartão(ões) importado(s)${failCount > 0 ? `, ${failCount} falharam` : ""}.`
          : `Todos os ${failCount} cartões falharam. Tente novamente mais tarde.`,
        variant: failCount > 0 && successCount === 0 ? "destructive" : "default",
      });
    } catch (error) {
      console.error("Error in sync process:", error);
      toast({
        title: "Erro na sincronização",
        description: "Não foi possível sincronizar todos os cartões.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      async (result) => {
        // Block concurrent scans while processing (use ref to avoid stale closure)
        if (isProcessingRef.current) return;

        // Throttle to max 3 scans per second
        const now = Date.now();
        if (now - lastScanTime.current < 333) return;
        lastScanTime.current = now;

        // Mark as processing (scanner keeps running, callback just gates)
        setIsScanning(false);
        setScannedResult(result.data);

        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate(200);
        }

        // Play beep sound
        playBeep();

        // Process the QR code
        await handleQRResult(result.data);
      },
      {
        returnDetailedScanResult: true,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 3,
      }
    );

    scannerRef.current = scanner;

    scanner.start().catch((err) => {
      console.error("Failed to start scanner:", err);
      toast({
        title: "Erro ao aceder à câmara",
        description: "Por favor, permita o acesso à câmara nas definições do seu dispositivo.",
        variant: "destructive",
      });
    });

    // Check if flashlight is available
    scanner.hasFlash().then((hasFlash) => {
      setHasFlash(hasFlash);
    });

    return () => {
      scanner.destroy();
    };
  }, []);

  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      console.error("Failed to play beep:", err);
    }
  };

  const toggleFlash = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.toggleFlash();
      setFlashOn(!flashOn);
    } catch (err) {
      console.error("Failed to toggle flash:", err);
      toast({
        title: "Erro",
        description: "Não foi possível ativar o flash.",
        variant: "destructive",
      });
    }
  };

  const handleQRResult = async (data: string) => {
    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      // 1. Check if it's a URL
      if (data.startsWith("http://") || data.startsWith("https://")) {
        if (!isOnline) {
          toast({
            title: "Sem ligação",
            description: "Não é possível abrir URLs sem ligação à internet.",
            variant: "destructive",
          });
          resetScanner();
          return;
        }
        window.open(data, "_blank");
        toast({
          title: "URL detetado",
          description: "A abrir no browser...",
        });
        resetScanner();
        return;
      }

      // 2. Check if it's a vCard
      if (isVCard(data)) {
        await handleVCard(data);
        return;
      }

      // 3. Check if it's a Divitek deep link
      if (data.startsWith("divitek-visit://")) {
        handleDeepLink(data);
        return;
      }

      // 4. Plain text - show options
      setScannedResult(data);
      setIsScanning(true);
      setIsProcessing(false);
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar código QR.",
        variant: "destructive",
      });
      resetScanner();
    } finally {
      // Always clear processing flag so scanner can process next QR
      isProcessingRef.current = false;
    }
  };

  const handleVCard = async (vcardData: string) => {
    const parsed = parseVCard(vcardData);
    if (!parsed || !parsed.name) {
      toast({
        title: "Erro",
        description: "Cartão de visita inválido ou incompleto.",
        variant: "destructive",
      });
      resetScanner();
      return;
    }

    // If offline, queue the import
    if (!isOnline) {
      try {
        await queueVCardImport({
          name: parsed.name,
          organization: parsed.organization,
          email: parsed.email,
          phone: parsed.phone,
          title: parsed.title,
          address: parsed.address,
          url: parsed.url,
          domain: parsed.domain,
        });

        toast({
          title: "Em fila",
          description: "Cartão guardado. Será importado quando recuperar a ligação.",
        });

        resetScanner();
        return;
      } catch (error) {
        console.error("Error queuing vCard:", error);
        toast({
          title: "Erro",
          description: "Não foi possível guardar o cartão offline.",
          variant: "destructive",
        });
        resetScanner();
        return;
      }
    }

    try {
      const res = await apiRequest("POST", "/api/tools/vcard-import", {
        name: parsed.name,
        organization: parsed.organization,
        email: parsed.email,
        phone: parsed.phone,
        title: parsed.title,
        address: parsed.address,
        url: parsed.url,
        domain: parsed.domain,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to import vCard" }));
        toast({
          title: "Erro ao importar",
          description: errorData.message || "Erro ao importar cartão de visita.",
          variant: "destructive",
        });
        resetScanner();
        return;
      }

      const response = await res.json() as {
        contacto: { id: string };
        entidade: {
          id: string;
          nome: string;
          status: 'existing' | 'created' | 'none';
        } | null;
        message: string;
      };

      // Invalidate caches
      await queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
      if (response.entidade) {
        await queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      }

      // Show appropriate toast based on entity status
      toast({
        title: response.entidade?.status === 'created' ? "Criados automaticamente" : "Contacto criado",
        description: response.message,
      });

      // If contact was created without entity, show dialog
      if (!response.entidade) {
        setPendingContact({
          id: response.contacto.id,
          name: parsed.name || "Contacto",
        });
        setShowContactDialog(true);
        // Clear processing state so scanner can resume
        setIsProcessing(false);
        setIsScanning(true);
      } else {
        // Navigate to contact detail
        setLocation(`/contactos/${response.contacto.id}`);
      }
    } catch (error) {
      console.error("Error importing vCard:", error);
      toast({
        title: "Erro",
        description: "Erro ao importar cartão de visita.",
        variant: "destructive",
      });
      resetScanner();
    }
  };

  const handleDeepLink = (link: string) => {
    // Only accept UUIDs or alphanumeric IDs (no path traversal)
    const regex = /^divitek-visit:\/\/(entidade|visita|contacto)\/([a-zA-Z0-9-]+)$/;
    const match = link.match(regex);

    if (!match) {
      toast({
        title: "Link inválido",
        description: "Formato de deep link não reconhecido.",
        variant: "destructive",
      });
      resetScanner();
      return;
    }

    const [, type, id] = match;

    // Additional validation: ID should look like a UUID or valid ID
    if (!id || id.includes('..') || id.includes('/')) {
      toast({
        title: "ID inválido",
        description: "Identificador do deep link não é válido.",
        variant: "destructive",
      });
      resetScanner();
      return;
    }

    switch (type) {
      case "entidade":
        setLocation(`/entidades/${id}`);
        break;
      case "visita":
        setLocation(`/visitas/${id}`);
        break;
      case "contacto":
        setLocation(`/contactos/${id}`);
        break;
    }

    toast({
      title: "Navegação",
      description: `A abrir ${type}...`,
    });
  };

  const resetScanner = () => {
    isProcessingRef.current = false;
    setScannedResult(null);
    setIsProcessing(false);
    setIsScanning(true);
  };

  const copyToClipboard = () => {
    if (!scannedResult) return;
    navigator.clipboard.writeText(scannedResult);
    toast({
      title: "Copiado",
      description: "Texto copiado para a área de transferência.",
    });
  };

  const searchOnGoogle = () => {
    if (!scannedResult) return;
    if (!isOnline) {
      toast({
        title: "Sem ligação",
        description: "Não é possível pesquisar sem ligação à internet.",
        variant: "destructive",
      });
      return;
    }
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(scannedResult)}`;
    window.open(searchUrl, "_blank");
  };

  // Dialog handlers
  const handleCreateEntity = async (entityName: string) => {
    if (!pendingContact) return;

    try {
      // Create entity
      const entityRes = await apiRequest("POST", "/api/entidades", {
        nome: entityName,
        tipoEntidade: "Contato Pessoal",
      });

      if (!entityRes.ok) {
        throw new Error("Failed to create entity");
      }

      const entity = await entityRes.json();

      // Update contact to link to entity
      const contactRes = await apiRequest("PATCH", `/api/contactos/${pendingContact.id}`, {
        entidadeId: entity.id,
      });

      if (!contactRes.ok) {
        throw new Error("Failed to link contact to entity");
      }

      // Invalidate caches
      await queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });

      toast({
        title: "Entidade criada",
        description: `Entidade "${entityName}" criada e associada ao contacto.`,
      });

      setShowContactDialog(false);
      setPendingContact(null);
      setLocation(`/contactos/${pendingContact.id}`);
    } catch (error) {
      console.error("Error creating entity:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a entidade.",
        variant: "destructive",
      });
    }
  };

  const handleAssociateLater = () => {
    if (!pendingContact) return;
    setShowContactDialog(false);
    setPendingContact(null);
    setLocation(`/contactos/${pendingContact.id}`);
  };

  const handleKeepWithoutEntity = () => {
    if (!pendingContact) return;
    setShowContactDialog(false);
    setPendingContact(null);
    setLocation(`/contactos/${pendingContact.id}`);
  };

  // Business card handlers
  const handleBusinessCardCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processBusinessCardImage = async (file: File) => {
    setIsProcessing(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Extract base64 data (remove data:image/...;base64, prefix)
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });

      reader.readAsDataURL(file);
      const base64Image = await base64Promise;

      // If offline, queue the import
      if (!isOnline) {
        await queueVisionCardImport(base64Image);

        toast({
          title: "Em fila",
          description: "Cartão guardado. Será processado quando recuperar a ligação.",
        });

        setIsProcessing(false);
        return;
      }

      // Process with Vision API
      const res = await apiRequest("POST", "/api/tools/vision-card", {
        base64Image,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to process business card" }));
        toast({
          title: "Erro ao processar",
          description: errorData.message || "Erro ao processar cartão de visita.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      const response = await res.json() as {
        contacto: { id: string };
        entidade: {
          id: string;
          nome: string;
          status: 'existing' | 'created' | 'none';
        } | null;
        extracted: any;
        message: string;
      };

      // Invalidate caches
      await queryClient.invalidateQueries({ queryKey: ["/api/contactos"] });
      if (response.entidade) {
        await queryClient.invalidateQueries({ queryKey: ["/api/entidades"] });
      }

      // Show appropriate toast
      toast({
        title: response.entidade?.status === 'created' ? "Criados automaticamente" : "Contacto criado",
        description: response.message,
      });

      // If contact was created without entity, show dialog
      if (!response.entidade) {
        setPendingContact({
          id: response.contacto.id,
          name: response.extracted.fullName || "Contacto",
        });
        setShowContactDialog(true);
        setIsProcessing(false);
      } else {
        // Navigate to contact detail
        setLocation(`/contactos/${response.contacto.id}`);
      }
    } catch (error) {
      console.error("Error processing business card:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar cartão de visita.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processBusinessCardImage(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Video container */}
      <div className="relative flex-1">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          data-testid="video-qr-scanner"
        />

        {/* Scanning frame overlay */}
        {isScanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-primary rounded-lg shadow-lg animate-pulse" />
          </div>
        )}

        {/* Success indicator */}
        {scannedResult && !isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-green-500/20 backdrop-blur-sm rounded-full p-8">
              <CheckCircle2 className="w-24 h-24 text-green-500" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 space-y-3">
        {/* Top row: close and flash */}
        <div className="flex justify-between items-center gap-2">
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setLocation("/")}
            data-testid="button-close-scanner"
            className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
          >
            <X className="w-5 h-5" />
          </Button>

          {hasFlash && scannerMode === 'qr' && (
            <Button
              size="icon"
              variant="secondary"
              onClick={toggleFlash}
              data-testid="button-toggle-flash"
              className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
            >
              {flashOn ? (
                <Flashlight className="w-5 h-5 text-yellow-400" />
              ) : (
                <FlashlightOff className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>

        {/* Mode switcher */}
        <div className="flex gap-2">
          <Button
            variant={scannerMode === 'qr' ? 'default' : 'secondary'}
            onClick={() => setScannerMode('qr')}
            data-testid="button-mode-qr"
            className="flex-1 bg-black/50 backdrop-blur-sm hover:bg-black/70"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Código QR
          </Button>
          <Button
            variant={scannerMode === 'businesscard' ? 'default' : 'secondary'}
            onClick={() => {
              setScannerMode('businesscard');
              handleBusinessCardCapture();
            }}
            disabled={isProcessing}
            data-testid="button-mode-businesscard"
            className="flex-1 bg-black/50 backdrop-blur-sm hover:bg-black/70"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Cartão de Visita
          </Button>
        </div>
      </div>

      {/* Hidden file input for business card */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-businesscard-file"
      />

      {/* Scanning status */}
      {isScanning && (
        <div className="absolute bottom-32 left-0 right-0 text-center">
          <p className="text-white text-lg font-medium drop-shadow-lg">
            Aponte a câmara para o código QR
          </p>
        </div>
      )}

      {/* Plain text result card */}
      {scannedResult && !isProcessing && (
        <Card className="absolute bottom-4 left-4 right-4 p-4 bg-background/95 backdrop-blur-sm">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold mb-2">Código QR detetado:</h3>
              <p className="text-sm text-muted-foreground break-all bg-muted p-3 rounded">
                {scannedResult}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="flex-1"
                data-testid="button-copy-qr"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar
              </Button>
              <Button
                onClick={searchOnGoogle}
                variant="outline"
                className="flex-1"
                data-testid="button-search-qr"
              >
                <Search className="w-4 h-4 mr-2" />
                Pesquisar
              </Button>
            </div>
            <Button
              onClick={resetScanner}
              className="w-full"
              data-testid="button-scan-again"
            >
              Digitalizar novamente
            </Button>
          </div>
        </Card>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4" />
            <p className="text-lg font-medium">A processar...</p>
          </div>
        </div>
      )}

      {/* Contact creation dialog */}
      <ContactCreationDialog
        open={showContactDialog}
        contactName={pendingContact?.name || "Contacto"}
        onCreateEntity={handleCreateEntity}
        onAssociateLater={handleAssociateLater}
        onKeepWithoutEntity={handleKeepWithoutEntity}
      />

      {/* Dead queue notification */}
      {deadItemsCount > 0 && !isProcessing && !scannedResult && (
        <Card className="absolute bottom-4 left-4 right-4 p-4 bg-destructive/10 backdrop-blur-sm border-destructive/50">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-destructive mb-1">Importações falhadas</h3>
              <p className="text-sm text-muted-foreground">
                {deadItemsCount} cartão(ões) falharam após 3 tentativas. Pode tentar novamente ou limpar.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  try {
                    const deadItems = await getDeadVCardImports();
                    
                    // Reset all dead items to pending
                    for (const item of deadItems) {
                      await retryDeadVCardImport(item.id);
                    }
                    
                    toast({
                      title: "A tentar novamente",
                      description: `${deadItems.length} cartão(ões) marcado(s) para nova tentativa.`,
                    });
                    
                    // Immediately trigger sync if online
                    if (isOnline) {
                      await syncOfflineQueue();
                    }
                    
                    // Refresh dead items count after sync
                    const updatedDeadItems = await getDeadVCardImports();
                    setDeadItemsCount(updatedDeadItems.length);
                  } catch (error) {
                    console.error("Error retrying dead items:", error);
                    toast({
                      title: "Erro",
                      description: "Não foi possível tentar novamente. Tente mais tarde.",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                className="flex-1"
                data-testid="button-retry-dead"
              >
                Tentar Novamente
              </Button>
              <Button
                onClick={async () => {
                  const count = await clearDeadVCardImports();
                  setDeadItemsCount(0);
                  toast({
                    title: "Limpeza concluída",
                    description: `${count} cartão(ões) falhado(s) removido(s).`,
                  });
                }}
                variant="destructive"
                className="flex-1"
                data-testid="button-clear-dead"
              >
                Limpar
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

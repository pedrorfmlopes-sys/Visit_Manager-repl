import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import QrScanner from "qr-scanner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Flashlight, FlashlightOff, X, Copy, Search, CheckCircle2 } from "lucide-react";
import { parseVCard, isVCard } from "@/lib/vcardParser";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

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
    if (!isOnline) {
      toast({
        title: "Sem ligação",
        description: "Não é possível importar cartões de visita sem ligação à internet.",
        variant: "destructive",
      });
      resetScanner();
      return;
    }

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

      // Navigate to contact detail
      setLocation(`/contactos/${response.contacto.id}`);
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
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setLocation("/")}
          data-testid="button-close-scanner"
          className="bg-black/50 backdrop-blur-sm hover:bg-black/70"
        >
          <X className="w-5 h-5" />
        </Button>

        {hasFlash && (
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
    </div>
  );
}

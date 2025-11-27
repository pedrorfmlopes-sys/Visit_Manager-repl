import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Hook reutilizável para gravação + transcrição de áudio.
 *
 * Expõe:
 *  - isRecording        -> se está a gravar neste momento
 *  - isTranscribing     -> se está a enviar áudio para o backend
 *  - hasAudio           -> se existe um clip gravado pronto a transcrever
 *  - recordingSeconds   -> contador simples de segundos da gravação actual
 *  - startRecording()   -> começa nova gravação (substitui a anterior)
 *  - stopRecording()    -> pára a gravação actual
 *  - transcribe()       -> envia o áudio gravado para o endpoint e devolve o texto
 *  - selectFileAndTranscribe() -> escolhe um ficheiro de áudio e transcreve
 */
export function useAudioTranscription(opts?: { endpoint?: string }) {
  const endpoint = opts?.endpoint || "/api/crm/leads/ai/transcribe";

  // Estado público
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Refs internos
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  const log = (...args: any[]) => {
    // Se quiseres, comenta isto em produção
    // eslint-disable-next-line no-console
    console.log("[useAudioTranscription]", ...args);
  };

  const clearRecordingTimer = () => {
    if (recordingIntervalRef.current != null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const cleanupMedia = () => {
    mediaRecorderRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  /**
   * Inicia uma nova gravação.
   * Se já existir uma gravação anterior, é descartada.
   */
  const startRecording = useCallback(async () => {
    try {
      if (isRecording) {
        return;
      }

      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador não suporta gravação de áudio.");
      }

      log("Starting recording...");

      // Pedir acesso ao microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Determinar mimeType suportado
      let mimeType: string | undefined;
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      if (typeof MediaRecorder !== "undefined" && (MediaRecorder as any).isTypeSupported) {
        for (const type of preferredTypes) {
          if ((MediaRecorder as any).isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      }

      const recorder =
        mimeType != null
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

      log("MediaRecorder created successfully with:", recorder.mimeType);
      audioChunksRef.current = [];
      audioBlobRef.current = null;
      setHasAudio(false);
      setRecordingSeconds(0);

      recorder.ondataavailable = (event: BlobEvent) => {
        const size = event.data?.size ?? 0;
        log("ondataavailable fired", {
          eventDataSize: size,
          eventDataType: event.data?.type,
        });
        if (size > 0) {
          audioChunksRef.current.push(event.data);
          log("Audio chunk stored", {
            chunks: audioChunksRef.current.length,
          });
        }
      };

      recorder.onstop = () => {
        const totalSize = audioChunksRef.current.reduce((acc, part: any) => {
          if (part && typeof (part as any).size === "number") {
            return acc + (part as any).size;
          }
          return acc;
        }, 0);

        const blob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        log("Recording stopped - blob created", {
          blobSize: blob.size,
          totalSize,
          chunks: audioChunksRef.current.length,
        });

        audioBlobRef.current = blob;
        setHasAudio(blob.size > 0);

        clearRecordingTimer();
        setIsRecording(false);
        cleanupMedia();
        audioChunksRef.current = [];
      };

      mediaRecorderRef.current = recorder;

      recorder.start(500); // timeslice de 500ms
      log("start(500) called; state:", recorder.state);
      setIsRecording(true);

      // Timer simples de segundos
      clearRecordingTimer();
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      log("Error while starting recording", error);
      cleanupMedia();
      clearRecordingTimer();
      setIsRecording(false);
      setHasAudio(false);
      throw error;
    }
  }, [isRecording]);

  /**
   * Pára a gravação actual (se existir).
   */
  const stopRecording = useCallback(() => {
    log("Stopping recording...");
    clearRecordingTimer();

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      // Se não houver recorder activo, apenas faz cleanup
      cleanupMedia();
      setIsRecording(false);
    }
  }, []);

  /**
   * Envia um Blob de áudio para o endpoint de transcrição.
   */
  const sendBlobForTranscription = useCallback(
    async (blob: Blob): Promise<string> => {
      if (!blob || blob.size === 0) {
        throw new Error("Nenhum áudio válido gravado para transcrever.");
      }

      const fileName = `gravacao-${Date.now()}.webm`;
      const file = new File([blob], fileName, {
        type: blob.type || "audio/webm",
      });

      const formData = new FormData();
      formData.append("file", file);

      setIsTranscribing(true);
      try {
        log("Sending file to endpoint...", {
          endpoint,
          fileName,
          fileSize: file.size,
          fileType: file.type,
        });

        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const rawText = await response.text();
        let data: { success: boolean; text?: string; message?: string } | null = null;

        try {
          data = rawText ? JSON.parse(rawText) : null;
        } catch {
          // Se não for JSON válido, lança erro com parte do texto
          throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 100)}`);
        }

        if (!data) {
          throw new Error(`Resposta vazia do servidor (HTTP ${response.status}).`);
        }

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message || `Falha na transcrição de áudio (HTTP ${response.status}).`
          );
        }

        const text = data.text ?? "";
        log("Transcription success", { textPreview: text.slice(0, 80) });
        return text;
      } finally {
        setIsTranscribing(false);
      }
    },
    [endpoint]
  );

  /**
   * Transcreve o áudio gravado (startRecording/stopRecording).
   */
  const transcribe = useCallback(async (): Promise<string> => {
    const blob = audioBlobRef.current;
    log("Transcribing recorded audio...", {
      hasBlob: !!blob,
      blobSize: blob?.size,
      blobType: blob?.type,
    });
    if (!blob || blob.size === 0) {
      throw new Error("Nenhum áudio válido gravado para transcrever.");
    }
    return sendBlobForTranscription(blob);
  }, [sendBlobForTranscription]);

  /**
   * Abre um selector de ficheiro, permite ao utilizador escolher um áudio
   * e envia esse ficheiro para transcrição.
   */
  const selectFileAndTranscribe = useCallback(async (): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/*";

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error("Nenhum ficheiro selecionado."));
          return;
        }
        try {
          const text = await sendBlobForTranscription(file);
          resolve(text);
        } catch (error) {
          reject(error);
        } finally {
          // limpar o input
          input.remove();
        }
      };

      input.onerror = () => {
        reject(new Error("Erro ao seleccionar ficheiro de áudio."));
        input.remove();
      };

      // acionar o file picker
      input.click();
    });
  }, [sendBlobForTranscription]);

  /**
   * Cleanup em unmount.
   */
  useEffect(() => {
    return () => {
      clearRecordingTimer();
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      cleanupMedia();
    };
  }, []);

  return {
    isRecording,
    isTranscribing,
    hasAudio,
    recordingSeconds,
    startRecording,
    stopRecording,
    transcribe,
    selectFileAndTranscribe,
  };
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UseAudioTranscriptionOptions {
  transcriptionEndpoint?: string; // Default: /api/visitas/:id/audio or /api/crm/leads/ai/transcribe
  onTranscriptionComplete?: (text: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Unified hook for audio recording and transcription
 * Encapsulates MediaRecorder + transcription logic for reuse across Visitas and Leads
 * 
 * FASE-IA-AUDIO-01: Extracted from VisitaForm and AdminLeadDetailPage
 */
export function useAudioTranscription(options: UseAudioTranscriptionOptions = {}) {
  const { toast } = useToast();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioBlob = useRef<Blob | null>(null);

  // Check browser support
  const [supportsRecording] = useState(
    typeof navigator !== 'undefined' && 
    (navigator.mediaDevices?.getUserMedia !== undefined) &&
    typeof MediaRecorder !== 'undefined'
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  /**
   * Start audio recording using MediaRecorder
   */
  const startRecording = useCallback(async () => {
    if (!supportsRecording) {
      const err = new Error('Gravação de áudio não suportada neste dispositivo.');
      toast({
        title: 'Erro',
        description: err.message,
        variant: 'destructive',
      });
      options.onError?.(err);
      return;
    }

    try {
      console.log('[useAudioTranscription] Starting recording...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Accumulate audio chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle stop event - create blob but don't transcribe yet
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        audioBlob.current = blob;
        
        // Stop all tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        setHasAudio(true);
        console.log('[useAudioTranscription] Recording stopped, audio ready for transcription');
      };

      // Handle error
      mediaRecorder.onerror = (event: any) => {
        console.error('[useAudioTranscription] MediaRecorder error:', event.error);
        const err = new Error('Não foi possível gravar áudio.');
        toast({
          title: 'Erro na gravação',
          description: err.message,
          variant: 'destructive',
        });
        setIsRecording(false);
        options.onError?.(err);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setHasAudio(false);

      // Start timer
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      console.log('[useAudioTranscription] Recording started');
    } catch (error: any) {
      console.error('[useAudioTranscription] Error starting recording:', error);

      const errorMsg = error?.name === 'NotAllowedError'
        ? 'Verifica as permissões do browser para o micro.'
        : 'Utilizando seletor de ficheiro em alternativa.';

      toast({
        title: 'Permissão ou erro',
        description: errorMsg,
        variant: error?.name === 'NotAllowedError' ? 'destructive' : 'default',
      });
      
      options.onError?.(error);
    }
  }, [supportsRecording, toast, options]);

  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('[useAudioTranscription] Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  }, [isRecording]);

  /**
   * Transcribe audio blob to text
   * Uses the provided endpoint or defaults to the passed blob/file
   */
  const transcribe = useCallback(
    async (blob?: Blob | File): Promise<string> => {
      const audioToTranscribe = blob || audioBlob.current;

      if (!audioToTranscribe) {
        const err = new Error('Nenhum áudio gravado ou fornecido.');
        toast({
          title: 'Erro',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }

      try {
        setIsTranscribing(true);
        console.log('[useAudioTranscription] Transcribing audio...', {
          size: audioToTranscribe.size,
          type: audioToTranscribe.type,
          endpoint: options.transcriptionEndpoint,
        });

        const formData = new FormData();
        formData.append('file', audioToTranscribe);

        const endpoint = options.transcriptionEndpoint || '/api/visitas/ai/transcribe';
        const response = await fetch(endpoint, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Falha ao transcrever áudio.');
        }

        console.log('[useAudioTranscription] Transcription success', {
          textLength: data.text?.length || 0,
        });

        toast({
          title: 'Áudio transcrito',
          description: 'Texto obtido com sucesso.',
        });

        options.onTranscriptionComplete?.(data.text);
        return data.text;
      } catch (error: any) {
        console.error('[useAudioTranscription] Transcription error:', error);
        const err = error instanceof Error ? error : new Error(String(error));
        toast({
          title: 'Falha na transcrição',
          description: err.message || 'Não foi possível transcrever o áudio.',
          variant: 'destructive',
        });
        options.onError?.(err);
        throw err;
      } finally {
        setIsTranscribing(false);
      }
    },
    [options, toast]
  );

  /**
   * Clear audio blob (reset state after using)
   */
  const clearAudio = useCallback(() => {
    audioBlob.current = null;
    setHasAudio(false);
    setRecordingTime(0);
  }, []);

  return {
    // State
    isRecording,
    isTranscribing,
    recordingTime,
    hasAudio,
    supportsRecording,

    // Methods
    startRecording,
    stopRecording,
    transcribe,
    clearAudio,

    // For direct access if needed (mainly for file upload fallback)
    audioBlob: audioBlob.current,
  };
}

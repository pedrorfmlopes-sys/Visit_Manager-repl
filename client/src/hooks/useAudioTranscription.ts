import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * FASE-AUDIO-CORE-01: Unified hook for audio recording and transcription
 * - Encapsulates MediaRecorder + transcription logic
 * - Reutilizável em Visitas, Leads, e qualquer outro módulo
 * - Usa o mesmo endpoint de transcrição que Visitas já usam
 */
export function useAudioTranscription(opts?: { endpoint?: string }) {
  const endpoint = opts?.endpoint || '/api/crm/leads/ai/transcribe';
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // References
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Timer effect: increment recordingSeconds while isRecording
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  /**
   * Start audio recording using MediaRecorder
   */
  const startRecording = useCallback(async () => {
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
          console.log('[useAudioTranscription] Audio chunk received', { size: event.data.size, chunks: audioChunksRef.current.length });
        }
      };

      // Handle stop event
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        audioBlobRef.current = blob;
        console.log('[useAudioTranscription] Recording stopped, blob size:', blob.size);
        setHasAudio(true);
        console.log('[useAudioTranscription] Recording stopped, audio ready for transcription');
      };

      // Handle error
      mediaRecorder.onerror = (event: any) => {
        console.error('[useAudioTranscription] MediaRecorder error:', event.error);
        setIsRecording(false);
      };

      // Start recording with timeslice to force data events
      mediaRecorder.start(500); // Request data every 500ms
      setIsRecording(true);
      setHasAudio(false);
      setRecordingSeconds(0);
      console.log('[useAudioTranscription] Recording started with 500ms timeslice');
    } catch (error: any) {
      console.error('[useAudioTranscription] Error starting recording:', error);
    }
  }, []);

  /**
   * Stop audio recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('[useAudioTranscription] Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  }, [isRecording]);

  /**
   * Transcribe the audio blob that was recorded via startRecording/stopRecording
   * Throws error if no audio blob available
   */
  const transcribe = useCallback(async (): Promise<string> => {
    if (!audioBlobRef.current) {
      throw new Error('Nenhum áudio gravado para transcrever.');
    }

    try {
      setIsTranscribing(true);
      console.log('[useAudioTranscription] Transcribing recorded audio...');

      const formData = new FormData();
      formData.append('file', audioBlobRef.current);

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Falha ao transcrever áudio.');
      }

      console.log('[useAudioTranscription] Transcription success');
      return data.text;
    } catch (error: any) {
      console.error('[useAudioTranscription] Transcription error:', error);
      throw error;
    } finally {
      setIsTranscribing(false);
    }
  }, [endpoint]);

  /**
   * Select a file and transcribe it
   * Opens file picker, user selects audio file, returns transcribed text
   */
  const selectFileAndTranscribe = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('Nenhum ficheiro selecionado.'));
          return;
        }

        try {
          setIsTranscribing(true);
          console.log('[useAudioTranscription] Transcribing file...', {
            name: file.name,
            size: file.size,
            type: file.type,
          });

          const formData = new FormData();
          formData.append('file', file);

          const response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text.slice(0, 100)}`);
          }

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.message || 'Falha ao transcrever áudio.');
          }

          console.log('[useAudioTranscription] File transcription success');
          resolve(data.text);
        } catch (error) {
          console.error('[useAudioTranscription] File transcription error:', error);
          reject(error);
        } finally {
          setIsTranscribing(false);
        }
      };

      input.click();
    });
  }, [endpoint]);

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

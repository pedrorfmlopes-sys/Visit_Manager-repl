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
   * FASE-AUDIO-CORE-07: Fixed blob size 0 by adding explicit mimeType
   */
  const startRecording = useCallback(async () => {
    try {
      console.log('[useAudioTranscription] Starting recording...');
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Try to create MediaRecorder with explicit mime type, fallback if not supported
      let mediaRecorder: MediaRecorder;
      const supportedMimeTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', ''];
      let selectedMimeType = '';
      
      for (const mimeType of supportedMimeTypes) {
        try {
          if (mimeType && !MediaRecorder.isTypeSupported(mimeType)) {
            console.log('[useAudioTranscription] mimeType not supported:', mimeType);
            continue;
          }
          const options = mimeType ? { mimeType } : {};
          mediaRecorder = new MediaRecorder(stream, options);
          selectedMimeType = mimeType || '(default)';
          console.log('[useAudioTranscription] MediaRecorder created successfully with:', selectedMimeType);
          break;
        } catch (e) {
          console.log('[useAudioTranscription] Failed to create with:', mimeType, e);
          continue;
        }
      }
      
      if (!mediaRecorder) {
        throw new Error('Failed to create MediaRecorder with any supported mime type');
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      console.log('[useAudioTranscription] MediaRecorder created', { 
        state: mediaRecorder.state,
        mimeType: 'audio/webm'
      });

      // CRITICAL: Register ondataavailable BEFORE start()
      mediaRecorder.ondataavailable = (event) => {
        console.log('[useAudioTranscription] ondataavailable fired', { 
          eventDataSize: event.data?.size,
          eventDataType: event.data?.type 
        });
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log('[useAudioTranscription] Audio chunk PUSHED', { 
            size: event.data.size, 
            totalChunks: audioChunksRef.current.length,
            totalSize: audioChunksRef.current.reduce((sum, b) => sum + b.size, 0)
          });
        }
      };

      // CRITICAL: Register onstop BEFORE start()
      mediaRecorder.onstop = () => {
        console.log('[useAudioTranscription] onstop fired', { 
          chunks: audioChunksRef.current.length,
          totalSize: audioChunksRef.current.reduce((sum, b) => sum + b.size, 0)
        });
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log('[useAudioTranscription] Recording stopped - blob created', {
          blobSize: blob.size,
          blobType: blob.type,
          chunks: audioChunksRef.current.length
        });
        audioBlobRef.current = blob;
        setHasAudio(blob.size > 0);
        
        // Stop all audio tracks to free up microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      // Handle error
      mediaRecorder.onerror = (event: any) => {
        console.error('[useAudioTranscription] MediaRecorder error:', event.error);
        setIsRecording(false);
      };

      // CRITICAL: Now start recording
      console.log('[useAudioTranscription] About to call start(500)', { state: mediaRecorder.state });
      try {
        mediaRecorder.start(500);
        console.log('[useAudioTranscription] start(500) called successfully', { state: mediaRecorder.state });
      } catch (startError: any) {
        console.error('[useAudioTranscription] Error calling start(500):', startError);
        throw startError;
      }
      
      setIsRecording(true);
      setHasAudio(false);
      setRecordingSeconds(0);
    } catch (error: any) {
      console.error('[useAudioTranscription] Fatal error in startRecording:', error);
      setIsRecording(false);
    }
  }, []);

  /**
   * Stop audio recording
   * FASE-AUDIO-CORE-07: Check state before stopping to prevent issues
   */
  const stopRecording = useCallback(() => {
    console.log('[useAudioTranscription] Stopping recording...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

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
      const blob = audioBlobRef.current;
      
      // FASE-AUDIO-CORE-06: Log blob details before transcription
      console.log('[useAudioTranscription] Transcribing recorded audio...', {
        blobSize: blob.size,
        blobType: blob.type,
        isValid: blob.size > 0 && blob.type.startsWith('audio/'),
      });

      // Convert Blob to File with proper mimetype
      const file = new File([blob], `gravacao-${Date.now()}.webm`, { 
        type: blob.type || 'audio/webm' 
      });

      console.log('[useAudioTranscription] Sending file to endpoint...', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
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

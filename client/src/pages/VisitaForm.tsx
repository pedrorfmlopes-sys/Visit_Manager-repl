import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, Calendar as CalendarIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertVisitaSchema, type InsertVisita, type Gabinete, type Contacto } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { z } from "zod";

const visitaFormSchema = insertVisitaSchema.extend({
  gabineteId: z.string().min(1, "Selecione um gabinete"),
  dataVisita: z.date(),
});

type VisitaFormData = z.infer<typeof visitaFormSchema>;

export default function VisitaForm() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const { data: gabinetes } = useQuery<Gabinete[]>({
    queryKey: ["/api/gabinetes"],
  });

  const { data: contactos } = useQuery<Contacto[]>({
    queryKey: ["/api/contactos"],
  });

  const form = useForm<VisitaFormData>({
    resolver: zodResolver(visitaFormSchema),
    defaultValues: {
      gabineteId: "",
      contactoId: "",
      dataVisita: new Date(),
      notas: "",
      marcasEntregues: [],
      proximaVisita: undefined,
      userId: "",
    },
  });

  const selectedGabineteId = form.watch("gabineteId");
  const filteredContactos = contactos?.filter(c => c.gabineteId === selectedGabineteId);

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/visitas", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/visitas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Sucesso",
        description: "Visita criada com sucesso! A processar IA...",
      });
      setLocation("/visitas");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "A fazer login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível criar a visita",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: VisitaFormData) => {
    const formData = new FormData();
    
    formData.append("gabineteId", data.gabineteId);
    if (data.contactoId) formData.append("contactoId", data.contactoId);
    formData.append("dataVisita", data.dataVisita.toISOString());
    if (data.notas) formData.append("notas", data.notas);
    if (data.proximaVisita) formData.append("proximaVisita", data.proximaVisita.toISOString());
    if (data.marcasEntregues) formData.append("marcasEntregues", JSON.stringify(data.marcasEntregues));
    
    if (audioFile) {
      formData.append("audio", audioFile);
    }
    
    mediaFiles.forEach((file) => {
      formData.append("media", file);
    });
    
    createMutation.mutate(formData);
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setMediaFiles(prev => [...prev, ...files].slice(0, 5));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/visitas")}
            data-testid="button-voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Nova Visita</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="gabineteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gabinete *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-gabinete">
                        <SelectValue placeholder="Selecione o gabinete" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {gabinetes?.map((gabinete) => (
                        <SelectItem key={gabinete.id} value={gabinete.id}>
                          {gabinete.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactoId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contacto</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || ""}
                    disabled={!selectedGabineteId}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12" data-testid="select-contacto">
                        <SelectValue placeholder={selectedGabineteId ? "Selecione o contacto" : "Selecione primeiro o gabinete"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredContactos?.map((contacto) => (
                        <SelectItem key={contacto.id} value={contacto.id}>
                          {contacto.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dataVisita"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Visita *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="h-12 w-full justify-start text-left font-normal"
                          data-testid="button-data-visita"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP", { locale: pt }) : "Selecione a data"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={pt}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas da Visita</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Descreva os pontos principais da visita..."
                      className="min-h-32 resize-none"
                      data-testid="input-notas"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    A IA irá analisar estas notas para gerar um resumo
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Áudio da Visita</FormLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioChange}
                  className="h-12"
                  data-testid="input-audio"
                />
              </div>
              {audioFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <span className="text-sm flex-1">{audioFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAudioFile(null)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                A IA irá transcrever automaticamente o áudio
              </p>
            </div>

            <div className="space-y-2">
              <FormLabel>Fotos/Vídeos</FormLabel>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaChange}
                  className="h-12"
                  data-testid="input-media"
                />
              </div>
              {mediaFiles.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {mediaFiles.map((file, idx) => (
                    <div key={idx} className="relative p-2 bg-muted rounded-md">
                      <span className="text-xs truncate block">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 h-6 w-6"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <FormField
              control={form.control}
              name="proximaVisita"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Próxima Visita</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className="h-12 w-full justify-start text-left font-normal"
                          data-testid="button-proxima-visita"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "PPP", { locale: pt }) : "Agendar próxima visita"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={pt}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sticky bottom-20 pt-4">
              <Button
                type="submit"
                className="w-full h-12"
                disabled={createMutation.isPending}
                data-testid="button-guardar"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A criar visita...
                  </>
                ) : (
                  "Criar Visita"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}

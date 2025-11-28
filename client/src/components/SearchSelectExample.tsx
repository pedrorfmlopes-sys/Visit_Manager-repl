/**
 * FASE SS-02: SearchSelect Example/Demo Component
 * Shows how to use SearchSelect with real endpoints
 */

import { useState } from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SearchSelectExample() {
  const [selectedEntidade, setSelectedEntidade] = useState<string | null>(null);
  const [selectedContacto, setSelectedContacto] = useState<string | null>(null);
  const [selectedVisita, setSelectedVisita] = useState<string | null>(null);

  // Fetch entidades from search endpoint
  const fetchEntidades = async (query: string): Promise<SearchSelectOption[]> => {
    try {
      const response = await fetch(
        `/api/crm/entidades/search?q=${encodeURIComponent(query)}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((item: any) => ({
        id: item.id,
        label: item.label,
        extraInfo: item.extraInfo,
      }));
    } catch (error) {
      console.error("Error fetching entidades:", error);
      return [];
    }
  };

  // Fetch contactos from search endpoint
  const fetchContactos = async (query: string): Promise<SearchSelectOption[]> => {
    try {
      const response = await fetch(
        `/api/crm/contactos/search?q=${encodeURIComponent(query)}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((item: any) => ({
        id: item.id,
        label: item.label,
        extraInfo: item.extraInfo,
      }));
    } catch (error) {
      console.error("Error fetching contactos:", error);
      return [];
    }
  };

  // Fetch visitas from search endpoint
  const fetchVisitas = async (query: string): Promise<SearchSelectOption[]> => {
    try {
      const response = await fetch(
        `/api/crm/visitas/search?q=${encodeURIComponent(query)}`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((item: any) => ({
        id: item.id,
        label: item.label,
        extraInfo: item.extraInfo,
      }));
    } catch (error) {
      console.error("Error fetching visitas:", error);
      return [];
    }
  };

  const handleReset = () => {
    setSelectedEntidade(null);
    setSelectedContacto(null);
    setSelectedVisita(null);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-4">SearchSelect Demo</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Testa os componentes SearchSelect com endpoints reais
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <SearchSelect
              value={selectedEntidade}
              onChange={setSelectedEntidade}
              fetchOptions={fetchEntidades}
              label="Entidade"
              placeholder="Pesquisar entidade..."
              data-testid="search-select-entidade"
            />
            {selectedEntidade && (
              <p className="text-xs text-muted-foreground mt-2">
                Selecionada: {selectedEntidade}
              </p>
            )}
          </div>

          <div>
            <SearchSelect
              value={selectedContacto}
              onChange={setSelectedContacto}
              fetchOptions={fetchContactos}
              label="Contacto"
              placeholder="Pesquisar contacto..."
              data-testid="search-select-contacto"
            />
            {selectedContacto && (
              <p className="text-xs text-muted-foreground mt-2">
                Selecionado: {selectedContacto}
              </p>
            )}
          </div>

          <div>
            <SearchSelect
              value={selectedVisita}
              onChange={setSelectedVisita}
              fetchOptions={fetchVisitas}
              label="Visita"
              placeholder="Pesquisar visita..."
              data-testid="search-select-visita"
            />
            {selectedVisita && (
              <p className="text-xs text-muted-foreground mt-2">
                Selecionada: {selectedVisita}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleReset}
            variant="outline"
            data-testid="button-reset-demo"
          >
            Reset
          </Button>
        </div>

        <div className="bg-muted p-4 rounded-md">
          <p className="text-xs font-mono text-muted-foreground">
            Seleções atuais:
            <br />
            entidade: {selectedEntidade || "null"}
            <br />
            contacto: {selectedContacto || "null"}
            <br />
            visita: {selectedVisita || "null"}
          </p>
        </div>
      </Card>
    </div>
  );
}

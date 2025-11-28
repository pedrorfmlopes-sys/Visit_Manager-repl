/**
 * FASE SS-03: CRM-specific SearchSelect Wrappers
 * Entidade, Contacto, and Visita search components
 */

import type {
  EntidadeSearchResult,
  ContactoSearchResult,
  VisitaSearchResult,
} from "@shared/schema";
import { SearchSelect, type SearchSelectOption } from "@/components/SearchSelect";

/**
 * EntidadeSearchSelect
 * Searches entities via /api/crm/entidades/search
 */
export interface EntidadeSearchSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function EntidadeSearchSelect({
  value,
  onChange,
  label = "Entidade",
  placeholder = "Pesquisar entidade...",
  disabled = false,
}: EntidadeSearchSelectProps) {
  const fetchEntidades = async (query: string): Promise<SearchSelectOption[]> => {
    try {
      const response = await fetch(
        `/api/crm/entidades/search?q=${encodeURIComponent(query)}`,
        { credentials: "include" }
      );
      if (!response.ok) return [];
      const data: EntidadeSearchResult[] = await response.json();
      return data.map((item) => ({
        id: item.id,
        label: item.label,
        extraInfo: item.extraInfo,
      }));
    } catch (error) {
      console.error("[EntidadeSearchSelect] Error:", error);
      return [];
    }
  };

  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      fetchOptions={fetchEntidades}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      data-testid="entidade-search-select"
    />
  );
}

/**
 * ContactoSearchSelect
 * Searches contacts via /api/crm/contactos/search
 * Optionally filters by entidadeId
 */
export interface ContactoSearchSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  entidadeId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ContactoSearchSelect({
  value,
  onChange,
  entidadeId,
  label = "Contacto",
  placeholder = "Pesquisar contacto...",
  disabled = false,
}: ContactoSearchSelectProps) {
  const fetchContactos = async (query: string): Promise<SearchSelectOption[]> => {
    try {
      let url = `/api/crm/contactos/search?q=${encodeURIComponent(query)}`;
      if (entidadeId) {
        url += `&entidadeId=${encodeURIComponent(entidadeId)}`;
      }

      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return [];
      const data: ContactoSearchResult[] = await response.json();
      return data.map((item) => ({
        id: item.id,
        label: item.label,
        extraInfo: item.extraInfo,
      }));
    } catch (error) {
      console.error("[ContactoSearchSelect] Error:", error);
      return [];
    }
  };

  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      fetchOptions={fetchContactos}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      data-testid="contacto-search-select"
    />
  );
}

/**
 * VisitaSearchSelect
 * Searches visits via /api/crm/visitas/search
 * Optionally filters by entidadeId
 */
export interface VisitaSearchSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  entidadeId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function VisitaSearchSelect({
  value,
  onChange,
  entidadeId,
  label = "Visita",
  placeholder = "Pesquisar visita...",
  disabled = false,
}: VisitaSearchSelectProps) {
  const fetchVisitas = async (query: string): Promise<SearchSelectOption[]> => {
    try {
      let url = `/api/crm/visitas/search?q=${encodeURIComponent(query)}`;
      if (entidadeId) {
        url += `&entidadeId=${encodeURIComponent(entidadeId)}`;
      }

      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) return [];
      const data: VisitaSearchResult[] = await response.json();
      return data.map((item) => ({
        id: item.id,
        label: item.label,
        extraInfo: item.extraInfo,
      }));
    } catch (error) {
      console.error("[VisitaSearchSelect] Error:", error);
      return [];
    }
  };

  return (
    <SearchSelect
      value={value}
      onChange={onChange}
      fetchOptions={fetchVisitas}
      label={label}
      placeholder={placeholder}
      disabled={disabled}
      data-testid="visita-search-select"
    />
  );
}

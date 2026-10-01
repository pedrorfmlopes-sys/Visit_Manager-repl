import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

export type OdooPartnerSearchResult = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  vat?: string | null;
  city?: string | null;
  country?: string | null;
};

export function useOdooPartnerSearch(enabled: boolean) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<OdooPartnerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedTerm = useDebounce(term, 300);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    async function search() {
      setIsLoading(true);
      setError(null);
      setNotConfigured(false);

      try {
        const response = await fetch(
          `/api/integrations/odoo/search-partner?q=${encodeURIComponent(debouncedTerm.trim())}`,
          {
            credentials: "include",
            signal: controller.signal,
          },
        );
        const data = await response.json();

        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || `HTTP ${response.status}`);
        }
        if (requestId !== requestIdRef.current) return;

        if (data?.notConfigured) {
          setNotConfigured(true);
          setResults([]);
          return;
        }
        if (data?.connectionError) {
          throw new Error(data?.message || "Falha ao autenticar no Odoo.");
        }

        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (searchError: any) {
        if (searchError?.name === "AbortError") return;
        if (requestId !== requestIdRef.current) return;
        setResults([]);
        setError(searchError?.message ?? "Erro ao pesquisar no Odoo.");
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false);
      }
    }

    void search();
    return () => controller.abort();
  }, [debouncedTerm, enabled, refreshKey]);

  return {
    term,
    setTerm,
    results,
    setResults,
    isLoading,
    error,
    setError,
    notConfigured,
    setNotConfigured,
    refresh: () => setRefreshKey((current) => current + 1),
    reset: () => {
      setTerm("");
      setResults([]);
      setError(null);
      setNotConfigured(false);
    },
  };
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Plus } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ContactoCard } from "@/components/ContactoCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import type { ContactoWithRelations } from "@shared/schema";

export default function Contactos() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contactos, isLoading } = useQuery<ContactoWithRelations[]>({
    queryKey: ["/api/contactos"],
  });

  const filteredContactos = contactos?.filter((contacto) => {
    const query = searchQuery.toLowerCase();
    return (
      contacto.nome.toLowerCase().includes(query) ||
      contacto.funcao?.toLowerCase().includes(query) ||
      contacto.email?.toLowerCase().includes(query) ||
      contacto.gabinete?.nome.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-card-border px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-foreground mb-3">Contactos</h1>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Pesquisar contactos..."
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : filteredContactos && filteredContactos.length > 0 ? (
          <div className="space-y-3">
            {filteredContactos.map((contacto) => (
              <ContactoCard
                key={contacto.id}
                contacto={contacto}
                onClick={() => setLocation(`/contactos/${contacto.id}`)}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <EmptyState
            icon={Users}
            title="Nenhum resultado"
            description="Não encontrámos contactos com esse critério de pesquisa."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Sem contactos"
            description="Comece por criar o seu primeiro contacto de gabinete."
            actionLabel="Criar Contacto"
            onAction={() => setLocation("/contactos/novo")}
          />
        )}
      </main>

      <FAB
        onClick={() => setLocation("/contactos/novo")}
        label="Criar Contacto"
        testId="button-criar-contacto"
      />
    </div>
  );
}

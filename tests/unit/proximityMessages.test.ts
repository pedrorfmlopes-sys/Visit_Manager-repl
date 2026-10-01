import assert from "node:assert/strict";
import test from "node:test";
import { buildSuggestionMessage } from "../../client/src/hooks/useNearbyVisitSuggestions";

test("builds useful messages for proximity alert reasons", () => {
  assert.match(
    buildSuggestionMessage({
      tipo: "tarefa_atrasada",
      entidadeId: "entity",
      entidadeNome: "Cliente",
      tarefaTitulo: "Telefonar",
      distanciaMetros: 120,
    }),
    /Telefonar.*120 m/,
  );
  assert.match(
    buildSuggestionMessage({
      tipo: "sem_visita_recente",
      entidadeId: "entity",
      entidadeNome: "Cliente",
      diasDesdeUltimaVisita: 75,
      distanciaMetros: 500,
    }),
    /75 dias.*500 m/,
  );
});

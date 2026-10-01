import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { BrandMark } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[App] Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-[#f4f7f3] px-6 py-12 text-[#15362f]">
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <BrandMark className="mb-8 h-16 w-16" title="Visit Manager" />
          <AlertTriangle className="mb-4 h-9 w-9 text-amber-600" />
          <h1 className="text-3xl font-semibold tracking-tight">
            Não foi possível abrir este ecrã
          </h1>
          <p className="mt-3 max-w-md text-base text-[#58706a]">
            Os seus dados não foram apagados. Atualize a aplicação para voltar a
            carregar a versão mais recente.
          </p>
          <Button
            className="mt-7 gap-2"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar aplicação
          </Button>
        </section>
      </main>
    );
  }
}

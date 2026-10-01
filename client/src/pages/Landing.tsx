import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LockKeyhole,
  Mail,
  Users,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { FaMicrosoft } from "react-icons/fa";
import { BrandLogo } from "@/components/BrandLogo";

type AuthMode = "login" | "register";
type SocialProvider = "google" | "microsoft";

interface AuthMethods {
  oidc: boolean;
  google: boolean;
  microsoft: boolean;
}

interface PendingSocial {
  provider: SocialProvider;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

async function submitAuth(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Não foi possível concluir o pedido.");
  }
  return payload;
}

function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    developmentResetUrl?: string;
  } | null>(null);
  const [error, setError] = useState("");

  const handleForgot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const payload = await submitAuth("/api/auth/password/forgot", {
        email: String(form.get("email") || ""),
      });
      setResult(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível processar o pedido.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="mt-8 space-y-5">
        <div className="rounded-xl border border-[#cfdac9] bg-white p-5">
          <CheckCircle2 className="h-6 w-6 text-[#426b49]" />
          <p className="mt-3 text-sm leading-relaxed text-[#425047]">
            {result.message}
          </p>
        </div>
        {result.developmentResetUrl && (
          <a
            href={result.developmentResetUrl}
            className="flex h-11 w-full items-center justify-center rounded-xl bg-[#22C7A9] text-sm font-semibold text-[#073B4C]"
            data-testid="development-reset-link"
          >
            Abrir link de recuperação local
          </a>
        )}
        <button
          type="button"
          className="w-full text-sm text-[#647067] underline-offset-4 hover:underline"
          onClick={onBack}
        >
          Voltar ao início de sessão
        </button>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleForgot}>
      <div className="space-y-2">
        <Label htmlFor="forgotEmail">Email da conta</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
          <Input
            id="forgotEmail"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 border-[#d2cfc5] bg-white pl-10"
            placeholder="nome@empresa.pt"
            data-testid="input-forgot-email"
          />
        </div>
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-xl bg-[#073B4C] text-base text-white hover:bg-[#0b5268]"
        data-testid="button-forgot-submit"
      >
        {isSubmitting ? "A enviar..." : "Enviar link de recuperação"}
      </Button>
      <button
        type="button"
        className="w-full text-sm text-[#647067] underline-offset-4 hover:underline"
        onClick={onBack}
      >
        Voltar ao início de sessão
      </button>
    </form>
  );
}

function ResetPassword({
  token,
  onBack,
}: {
  token: string;
  onBack: () => void;
}) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(
      `/api/auth/password/reset/validate?token=${encodeURIComponent(token)}`,
      { credentials: "include" },
    )
      .then((response) => response.json())
      .then((payload) => setIsValid(Boolean(payload.valid)))
      .catch(() => setIsValid(false));
  }, [token]);

  const handleReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== String(form.get("passwordConfirmation") || "")) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitAuth("/api/auth/password/reset", { token, password });
      setIsComplete(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível alterar a palavra-passe.",
      );
      setIsValid(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValid === null) {
    return <p className="mt-8 text-sm text-[#647067]">A validar o link...</p>;
  }
  if (!isValid && !isComplete) {
    return (
      <div className="mt-8 space-y-5">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Este link é inválido, expirou ou já foi utilizado.
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={onBack}
        >
          Pedir um novo link
        </Button>
      </div>
    );
  }
  if (isComplete) {
    return (
      <div className="mt-8 space-y-5">
        <p className="rounded-xl border border-[#cfdac9] bg-white p-5 text-sm text-[#425047]">
          Palavra-passe alterada. Já pode iniciar sessão.
        </p>
        <Button
          type="button"
          className="h-11 w-full rounded-xl bg-[#073B4C] text-white"
          onClick={onBack}
          data-testid="button-reset-back-to-login"
        >
          Entrar
        </Button>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleReset}>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nova palavra-passe</Label>
        <Input
          id="newPassword"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          className="h-11 border-[#d2cfc5] bg-white"
          placeholder="Mínimo de 10 caracteres"
          data-testid="input-reset-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPasswordConfirmation">
          Confirmar palavra-passe
        </Label>
        <Input
          id="newPasswordConfirmation"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          className="h-11 border-[#d2cfc5] bg-white"
          placeholder="Repita a palavra-passe"
          data-testid="input-reset-password-confirmation"
        />
      </div>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-12 w-full rounded-xl bg-[#073B4C] text-base text-white hover:bg-[#0b5268]"
        data-testid="button-reset-submit"
      >
        {isSubmitting ? "A alterar..." : "Alterar palavra-passe"}
      </Button>
    </form>
  );
}

function SocialCompletion({
  pending,
  onCancel,
}: {
  pending: PendingSocial;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const providerName = pending.provider === "google" ? "Google" : "Microsoft";

  const handleComplete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      await submitAuth("/api/auth/social/complete", {
        companyName: String(form.get("companyName") || ""),
      });
      window.location.assign("/");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível criar a conta.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="rounded-xl border border-[#d8d4c9] bg-white p-4">
        <p className="text-sm font-medium">
          Conta {providerName} confirmada
        </p>
        <p className="mt-1 text-sm text-[#647067]">{pending.email}</p>
      </div>
      <form className="mt-5 space-y-5" onSubmit={handleComplete}>
        <div className="space-y-2">
          <Label htmlFor="socialCompanyName">Nome da empresa</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
            <Input
              id="socialCompanyName"
              name="companyName"
              autoComplete="organization"
              required
              minLength={2}
              className="h-11 border-[#d2cfc5] bg-white pl-10"
              placeholder="Nome da empresa"
              data-testid="input-social-company"
            />
          </div>
        </div>
        {error && (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-12 w-full rounded-xl bg-[#073B4C] text-base text-white hover:bg-[#0b5268]"
          data-testid="button-social-complete"
        >
          {isSubmitting ? "A criar conta..." : "Concluir criação da conta"}
          {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
        <button
          type="button"
          className="w-full text-sm text-[#647067] underline-offset-4 hover:underline"
          onClick={onCancel}
        >
          Usar outra forma de entrar
        </button>
      </form>
    </div>
  );
}

export default function Landing() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [authMethods, setAuthMethods] = useState<AuthMethods>({
    oidc: false,
    google: false,
    microsoft: false,
  });
  const [pendingSocial, setPendingSocial] = useState<PendingSocial | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(window.location.search).get("resetToken") || "",
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/methods").then((response) => response.json()),
      fetch("/api/auth/social/pending").then((response) => response.json()),
    ])
      .then(([methods, pending]) => {
        setAuthMethods({
          oidc: Boolean(methods.oidc),
          google: Boolean(methods.google),
          microsoft: Boolean(methods.microsoft),
        });
        setPendingSocial(pending.pending || null);
      })
      .catch(() => undefined);

    const authError = new URLSearchParams(window.location.search).get(
      "authError",
    );
    if (authError === "existing_account") {
      setError(
        "Este email já tem conta. Entre com a palavra-passe para evitar uma associação indevida.",
      );
    } else if (authError === "inactive") {
      setError("Esta conta está inativa.");
    } else if (authError === "license_inactive") {
      setError("A licença desta empresa não está ativa.");
    } else if (authError) {
      setError("Não foi possível autenticar com o fornecedor selecionado.");
    }
  }, []);

  const cancelSocialRegistration = async () => {
    await fetch("/api/auth/social/pending", {
      method: "DELETE",
      credentials: "include",
    });
    setPendingSocial(null);
    window.history.replaceState({}, "", "/login");
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setForgotMode(false);
    setError("");
  };

  const returnToLogin = () => {
    setForgotMode(false);
    setResetToken("");
    setMode("login");
    setError("");
    window.history.replaceState({}, "", "/login");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");

    if (
      mode === "register" &&
      password !== String(form.get("passwordConfirmation") || "")
    ) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        await submitAuth("/api/auth/login", {
          email: String(form.get("email") || ""),
          password,
        });
      } else {
        await submitAuth("/api/auth/register", {
          name: String(form.get("name") || ""),
          companyName: String(form.get("companyName") || ""),
          email: String(form.get("email") || ""),
          password,
        });
      }
      window.location.assign("/");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível concluir o pedido.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#17211a] lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#073B4C] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 top-28 h-80 w-80 rounded-full border border-[#22C7A9]/30" />
        <div className="absolute -right-10 top-48 h-52 w-52 rounded-full bg-[#22C7A9]/10" />

        <BrandLogo
          className="relative"
          markClassName="h-12 w-12"
          wordmarkClassName="text-xl"
          inverse
        />

        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-[#22C7A9]">
            Trabalho comercial, organizado
          </p>
          <h1 className="text-5xl font-semibold leading-[1.06] tracking-[-0.04em]">
            Da visita ao próximo passo, sem perder contexto.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/65">
            Centralize contactos, visitas, tarefas e informação comercial numa
            aplicação preparada para trabalhar no terreno.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 border-t border-white/10 pt-7 text-sm text-white/70">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#22C7A9]" />
            Multiempresa
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#22C7A9]" />
            Mobile-first
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#22C7A9]" />
            Sincronização
          </span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <BrandLogo className="mb-9 lg:hidden" />

          <p className="text-sm font-medium text-[#647067]">
            {resetToken
              ? "Proteja a sua conta"
              : forgotMode
                ? "Recuperação de acesso"
                : mode === "login"
                  ? "Bem-vindo de volta"
                  : "Comece agora"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            {resetToken
              ? "Definir nova palavra-passe"
              : forgotMode
                ? "Recuperar palavra-passe"
                : mode === "login"
                  ? "Entrar na sua conta"
                  : "Criar uma conta"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#647067]">
            {resetToken
              ? "Escolha uma palavra-passe nova para voltar a entrar."
              : forgotMode
                ? "Enviaremos um link temporário para o email da conta."
                : pendingSocial
              ? "Só falta identificar a empresa para preparar o seu espaço."
              : mode === "login"
              ? "Use o email e a palavra-passe associados à sua conta."
              : "A sua empresa e conta de administrador ficam prontas de imediato."}
          </p>

          {resetToken ? (
            <ResetPassword token={resetToken} onBack={returnToLogin} />
          ) : forgotMode ? (
            <ForgotPassword onBack={returnToLogin} />
          ) : pendingSocial ? (
            <SocialCompletion
              pending={pendingSocial}
              onCancel={cancelSocialRegistration}
            />
          ) : (
            <>
          <div
            className="mt-8 grid grid-cols-2 rounded-xl bg-[#e9e6dc] p-1"
            role="tablist"
            aria-label="Modo de autenticação"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => changeMode("login")}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-white text-[#17211a] shadow-sm"
                  : "text-[#647067]"
              }`}
              data-testid="tab-login"
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              onClick={() => changeMode("register")}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-white text-[#17211a] shadow-sm"
                  : "text-[#647067]"
              }`}
              data-testid="tab-register"
            >
              Criar conta
            </button>
          </div>

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">O seu nome</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
                    <Input
                      id="name"
                      name="name"
                      autoComplete="name"
                      required
                      minLength={2}
                      className="h-11 border-[#d2cfc5] bg-white pl-10"
                      placeholder="Nome completo"
                      data-testid="input-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
                    <Input
                      id="companyName"
                      name="companyName"
                      autoComplete="organization"
                      required
                      minLength={2}
                      className="h-11 border-[#d2cfc5] bg-white pl-10"
                      placeholder="Nome da empresa"
                      data-testid="input-company"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="h-11 border-[#d2cfc5] bg-white pl-10"
                  placeholder="nome@empresa.pt"
                  data-testid="input-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "register" ? 10 : 1}
                  maxLength={128}
                  className="h-11 border-[#d2cfc5] bg-white pl-10"
                  placeholder={
                    mode === "register" ? "Mínimo de 10 caracteres" : "••••••••••"
                  }
                  data-testid="input-password"
                />
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="passwordConfirmation">
                  Confirmar palavra-passe
                </Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-3 h-4 w-4 text-[#778178]" />
                  <Input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    maxLength={128}
                    className="h-11 border-[#d2cfc5] bg-white pl-10"
                    placeholder="Repita a palavra-passe"
                    data-testid="input-password-confirmation"
                  />
                </div>
              </div>
            )}

            {mode === "login" && (
              <button
                type="button"
                className="w-full text-right text-sm font-medium text-[#425047] underline-offset-4 hover:underline"
                onClick={() => {
                  setForgotMode(true);
                  setError("");
                }}
                data-testid="button-forgot-password"
              >
                Esqueci-me da palavra-passe
              </button>
            )}

            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                role="alert"
                data-testid="auth-error"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-[#073B4C] text-base text-white hover:bg-[#0b5268]"
              data-testid={mode === "login" ? "button-login" : "button-register"}
            >
              {isSubmitting
                ? "A processar..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
              {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          {(authMethods.google ||
            authMethods.microsoft ||
            authMethods.oidc) && (
            <div className="mt-6 border-t border-[#d9d5ca] pt-6">
              <p className="mb-4 text-center text-xs uppercase tracking-[0.18em] text-[#778178]">
                ou continue com
              </p>
              <div className="space-y-3">
                {authMethods.google && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-[#c9c5ba] bg-white"
                    onClick={() => window.location.assign("/api/auth/google")}
                    data-testid="button-google-auth"
                  >
                    <FcGoogle className="mr-2 h-5 w-5" />
                    Google
                  </Button>
                )}
                {authMethods.microsoft && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-[#c9c5ba] bg-white"
                    onClick={() =>
                      window.location.assign("/api/auth/microsoft")
                    }
                    data-testid="button-microsoft-auth"
                  >
                    <FaMicrosoft className="mr-2 h-4 w-4 text-[#00a4ef]" />
                    Microsoft
                  </Button>
                )}
                {authMethods.oidc && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-[#c9c5ba] bg-transparent"
                    onClick={() => window.location.assign("/api/login")}
                  >
                    Continuar com SSO
                  </Button>
                )}
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

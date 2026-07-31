import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Car, ArrowLeft } from "lucide-react";
import { translateError } from "@/lib/supabase-errors";

type Mode = "login" | "reset" | "newPassword";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Detecta quando o usuário chega via link "Esqueci senha" — Supabase emite PASSWORD_RECOVERY
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("newPassword");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email) {
      toast.error("Informe seu e-mail para receber o link de redefinição.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Enviamos um link para redefinir sua senha. Confira seu e-mail.");
      setMode("login");
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword.length < 6) {
      toast.error("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha atualizada! Você já está logado.");
      // após atualizar, o session vira ativa e o AuthProvider redireciona sozinho
    } catch (err) {
      toast.error(translateError(err as { message?: string }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-[hsl(45,100%,50%)] text-[hsl(0,0%,10%)]">
            <Car className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Trato Feito Bank</CardTitle>
          <CardDescription>
            {mode === "login" && "Gestão Veicular"}
            {mode === "reset" && "Recuperar acesso"}
            {mode === "newPassword" && "Definir nova senha"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "login" && (
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-[hsl(45,100%,50%)] text-[hsl(0,0%,10%)] hover:bg-[hsl(45,100%,45%)]" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("reset")}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="email-reset">E-mail cadastrado</Label>
                <Input
                  id="email-reset"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enviaremos um link para redefinir sua senha.
                </p>
              </div>
              <Button
                type="submit"
                className="w-full bg-[hsl(45,100%,50%)] text-[hsl(0,0%,10%)] hover:bg-[hsl(45,100%,45%)]"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> voltar para login
              </button>
            </form>
          )}

          {mode === "newPassword" && (
            <form onSubmit={handleNewPassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[hsl(45,100%,50%)] text-[hsl(0,0%,10%)] hover:bg-[hsl(45,100%,45%)]"
                disabled={loading}
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("senda_token", data.token);
      localStorage.setItem("senda_user", JSON.stringify(data.user));
      window.location.href = "/";
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email && !phone) { setError("Email o telefono requerido"); return; }
    if (!password) { setError("Password requerido"); return; }
    setLoading(true);
    loginMutation.mutate({ email: email || undefined, phone: phone || undefined, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 px-4">
      <div className="w-full max-w-md">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Iniciar Sesion</CardTitle>
            <CardDescription className="text-white/50">Entra a tu cuenta de La Senda del Saber</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />{error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70 text-center block">o</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white/70">Telefono</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="3001234567" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Tu password" className="bg-white/5 border-white/10 text-white" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-center text-white/50 text-sm">
                No tienes cuenta? <Link to="/register" className="text-amber-400 hover:text-amber-300">Registrate</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

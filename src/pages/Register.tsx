import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const registerMutation = trpc.localAuth.register.useMutation({
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

    if (!name.trim()) { setError("Nombre requerido"); return; }
    if (!email && !phone) { setError("Email o telefono requerido"); return; }
    if (password.length < 6) { setError("Password minimo 6 caracteres"); return; }
    if (password !== confirmPassword) { setError("Passwords no coinciden"); return; }

    setLoading(true);
    registerMutation.mutate({ name, email: email || undefined, phone: phone || undefined, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-900 to-indigo-950 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-white/10 bg-white/5 backdrop-blur-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white">Crear Cuenta</CardTitle>
            <CardDescription className="text-white/50">
              Registrate para jugar La Senda del Saber
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-white/70">Nombre</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre" className="bg-white/5 border-white/10 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70">Email (opcional)</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com" className="bg-white/5 border-white/10 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white/70">Telefono (opcional)</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="3001234567" className="bg-white/5 border-white/10 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres" className="bg-white/5 border-white/10 text-white" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-white/70">Confirmar Password</Label>
                <Input id="confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu password" className="bg-white/5 border-white/10 text-white" />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>

              <p className="text-center text-white/50 text-sm">
                Ya tienes cuenta? <Link to="/login" className="text-amber-400 hover:text-amber-300">Inicia sesion</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

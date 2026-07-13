import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-4xl font-bold">La Senda del Saber</h1>
      <p className="text-muted-foreground">Juego de trivia bíblica</p>
      <div className="flex gap-4">
        <Link to="/game">
          <Button size="lg">Jugar</Button>
        </Link>
        <Link to="/login">
          <Button variant="outline" size="lg">Login</Button>
        </Link>
      </div>
    </div>
  );
}

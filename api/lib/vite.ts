import fs from "fs";
import path from "path";

export function resolveIndexHtml(): string {
  const indexPath = path.resolve(process.cwd(), "dist", "index.html");
  if (fs.existsSync(indexPath)) {
    return fs.readFileSync(indexPath, "utf-8");
  }
  return "<!DOCTYPE html><html><body>App not built yet</body></html>";
}

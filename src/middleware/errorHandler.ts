import { NextFunction, Request, Response } from "express";

// middleware globale per la gestione errori
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("Error:", err);

  if (res.headersSent) {
    return;
  }

  const status = err.statusCode || 500;
  const message =
    err.message || "Qualcosa è esploso nel backend (controlla i log).";

  res.status(status).json({ error: message });
}
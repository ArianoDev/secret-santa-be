import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { ENV } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";

import participantsRouter from "./routes/participants";
import drawsRouter from "./routes/draws";
import assignmentsRouter from "./routes/assignments";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: ENV.CORS_ORIGIN,
    credentials: false
  })
);
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "Secret Santa backend vivo e vegeto 🎅" });
});

// Routes
app.use("/api/participants", participantsRouter);
app.use("/api/draws", drawsRouter);
app.use("/api/assignments", assignmentsRouter);

// Error handler
app.use(errorHandler);

app.listen(ENV.PORT, () => {
  console.log(`✅ Secret Santa backend in ascolto su :${ENV.PORT}`);
});
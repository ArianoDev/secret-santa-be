import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

export const ENV = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 4000,
  DATABASE_URL: required("DATABASE_URL"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*"
};
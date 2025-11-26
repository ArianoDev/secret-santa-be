import { Router, Request, Response, NextFunction } from "express";
import { query } from "../db/pool";

const router = Router();

/**
 * GET /api/assignments/a
 * Ritorna gli abbinamenti correnti Modalità A
 */
router.get(
  "/a",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `select a.id, a.giver_id, a.receiver_id, a.created_at,
                g.first_name as giver_first_name,
                g.last_name as giver_last_name,
                r.first_name as receiver_first_name,
                r.last_name as receiver_last_name
         from assignments_a a
         join participants g on g.id = a.giver_id
         join participants r on r.id = a.receiver_id
         order by a.id asc`
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/assignments/a/generate
 * Rigenera l'intera mappatura (derangement)
 */
router.post(
  "/a/generate",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const participantsResult = await query(
        `select id from participants order by created_at asc`
      );
      const participants = participantsResult.rows;

      if (participants.length < 2) {
        return res.status(400).json({
          error: "Servono almeno 2 partecipanti per generare gli abbinamenti."
        });
      }

      const ids = participants.map((p) => p.id as string);
      const deranged = generateDerangement(ids);

      // transazione: svuota e reinserisci
      await query("begin");
      try {
        await query("delete from assignments_a");
        for (let i = 0; i < ids.length; i++) {
          await query(
            `insert into assignments_a (giver_id, receiver_id)
             values ($1, $2)`,
            [ids[i], deranged[i]]
          );
        }
        await query("commit");
      } catch (err) {
        await query("rollback");
        throw err;
      }

      const result = await query(
        `select a.id, a.giver_id, a.receiver_id, a.created_at,
                g.first_name as giver_first_name,
                g.last_name as giver_last_name,
                r.first_name as receiver_first_name,
                r.last_name as receiver_last_name
         from assignments_a a
         join participants g on g.id = a.giver_id
         join participants r on r.id = a.receiver_id
         order by a.id asc`
      );

      res.status(201).json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Semplice derangement per array di ID (no fixed point)
 */
function generateDerangement<T>(arr: T[]): T[] {
  const n = arr.length;
  const indices = [...Array(n).keys()];

  const isDerangement = (perm: number[]) =>
    perm.every((val, idx) => val !== idx);

  let attempt = 0;
  while (true) {
    attempt++;
    const perm = [...indices];
    for (let i = perm.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }

    if (isDerangement(perm)) {
      return perm.map((i) => arr[i]);
    }

    if (attempt > 1000) {
      console.warn("Impossibile generare derangement dopo molti tentativi");
      return arr; // fallback brutto ma almeno non esplode
    }
  }
}

export default router;
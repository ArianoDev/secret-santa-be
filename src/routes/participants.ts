import { Router, Request, Response, NextFunction } from "express";
import { query } from "../db/pool";

const router = Router();

/**
 * GET /api/participants
 * Ritorna lista di partecipanti
 */
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      "select id, first_name, last_name, preferred_mode, created_at from participants order by created_at asc"
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/participants
 * body: { firstName, lastName, preferredMode }
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, preferredMode } = req.body;

    if (!firstName || !lastName || !preferredMode) {
      return res
        .status(400)
        .json({ error: "firstName, lastName e preferredMode sono obbligatori." });
    }

    if (!["A", "B"].includes(preferredMode)) {
      return res.status(400).json({ error: "preferredMode deve essere 'A' o 'B'." });
    }

    try {
      const result = await query(
        `insert into participants (first_name, last_name, preferred_mode)
         values ($1, $2, $3)
         returning id, first_name, last_name, preferred_mode, created_at`,
        [firstName, lastName, preferredMode]
      );

      res.status(201).json(result.rows[0]);
    } catch (err: any) {
      // violazione unique index (duplicato nome+cognome)
      if (err.code === "23505") {
        return res.status(409).json({
          error:
            "Esiste già un partecipante con questo nome e cognome. Se siete in due con lo stesso nome, tocca metterci un soprannome."
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/participants/:id
 */
router.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await query("delete from participants where id = $1", [id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Partecipante non trovato." });
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
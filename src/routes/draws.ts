import { Router, Request, Response, NextFunction } from "express";
import { query } from "../db/pool";

const router = Router();

/**
 * GET /api/draws/b
 * Ritorna lista delle estrazioni già fatte (in ordine)
 */
router.get(
  "/b",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await query(
        `select d.id, d.participant_id, d.draw_order, d.created_at,
                p.first_name, p.last_name
         from draws_b d
         join participants p on p.id = d.participant_id
         order by d.draw_order asc`
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/draws/b/next
 * Estrae il prossimo partecipante NON ancora estratto
 */
router.post(
  "/b/next",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // lista partecipanti non ancora estratti
      const remaining = await query(
        `select p.id, p.first_name, p.last_name
         from participants p
         where not exists (
           select 1 from draws_b d where d.participant_id = p.id
         )`
      );

      if (remaining.rowCount === 0) {
        return res.status(400).json({
          error: "Tutti i partecipanti sono già stati estratti."
        });
      }

      const rows = remaining.rows;
      const randomIndex = Math.floor(Math.random() * rows.length);
      const chosen = rows[randomIndex];

      // calcola order = max(draw_order) + 1
      const maxOrderResult = await query(
        "select coalesce(max(draw_order), 0) as max_order from draws_b"
      );
      const nextOrder = Number(maxOrderResult.rows[0].max_order) + 1;

      const insertResult = await query(
        `insert into draws_b (participant_id, draw_order)
         values ($1, $2)
         returning id, participant_id, draw_order, created_at`,
        [chosen.id, nextOrder]
      );

      res.status(201).json({
        draw: insertResult.rows[0],
        participant: chosen
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
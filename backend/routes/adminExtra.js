import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  getPageViewStats, getRecentPageViews,
  getTickets, getTicket, replyTicket, updateTicketStatus, createTicket,
  getMembers,
} from '../services/store.js';
import { query } from '../services/db.js';

// ── Admin router (/api/admin/*) ───────────────────────────────────────────────

export const adminRouter = Router();

adminRouter.get('/stats', async (req, res) => {
  try {
    const [stats, recent, members] = await Promise.all([
      getPageViewStats(),
      getRecentPageViews(200),
      getMembers(),
    ]);
    res.json({ stats, recent, memberCount: members.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/tickets', async (req, res) => {
  try {
    const tickets = await getTickets(req.query.status ? { status: req.query.status } : undefined);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.post('/tickets/:id/reply', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Reply body required' });
  try {
    await replyTicket({ ticketId: req.params.id, sender: req.username, senderRole: 'admin', body: body.trim() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

adminRouter.patch('/tickets/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['open', 'pending', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await updateTicketStatus(req.params.id, status);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Support router (/api/support/*) — user-facing ────────────────────────────

export const supportRouter = Router();

supportRouter.post('/', async (req, res) => {
  const { subject, message } = req.body;
  if (!subject?.trim() || !message?.trim()) return res.status(400).json({ error: 'Subject and message required' });
  try {
    const id = randomUUID();
    await createTicket({ id, userId: req.userId, username: req.username, subject: subject.trim(), firstMessage: message.trim() });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

supportRouter.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.*, COUNT(m.id) AS message_count
       FROM support_tickets t
       LEFT JOIN support_messages m ON m.ticket_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id ORDER BY t.updated_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

supportRouter.get('/:id', async (req, res) => {
  try {
    const ticket = await getTicket(req.params.id);
    if (!ticket || ticket.user_id !== req.userId) return res.status(404).json({ error: 'Not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

supportRouter.post('/:id/reply', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Message required' });
  try {
    const ticket = await getTicket(req.params.id);
    if (!ticket || ticket.user_id !== req.userId) return res.status(404).json({ error: 'Not found' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed' });
    await replyTicket({ ticketId: req.params.id, sender: req.username, senderRole: 'user', body: body.trim() });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

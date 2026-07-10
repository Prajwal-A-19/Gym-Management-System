const express = require('express');
const bcrypt = require('bcryptjs');
const { dbAll, dbRun, dbGet } = require('../database');
const { authenticateToken, isAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authenticateToken, isAdmin);

// ── DASHBOARD ──────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
    try {
        const totalMembers = await dbGet('SELECT COUNT(*) as count FROM members');
        const activeMembers = await dbGet("SELECT COUNT(*) as count FROM members WHERE status='Active'");
        const totalTrainers = await dbGet("SELECT COUNT(*) as count FROM users WHERE role='Trainer'");
        const monthlyRevenue = await dbGet("SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE strftime('%Y-%m', payment_date)=strftime('%Y-%m','now') AND status='Paid'");
        const pendingPayments = await dbGet("SELECT COUNT(*) as count FROM payments WHERE status='Pending'");
        const todayAttendance = await dbGet("SELECT COUNT(*) as count FROM attendance WHERE date(check_in_time)=date('now')");
        const expiringPlans = await dbGet("SELECT COUNT(*) as count FROM members WHERE plan_end_date BETWEEN date('now') AND date('now','+7 days') AND status='Active'");
        const recentPayments = await dbAll("SELECT p.*, m.first_name||' '||m.last_name as member_name, pl.name as plan_name FROM payments p LEFT JOIN members m ON p.member_id=m.id LEFT JOIN plans pl ON p.plan_id=pl.id ORDER BY p.payment_date DESC LIMIT 5");
        const attendanceTrend = await dbAll("SELECT date(check_in_time) as date, COUNT(*) as count FROM attendance GROUP BY date(check_in_time) ORDER BY date(check_in_time) DESC LIMIT 14");
        const planDistribution = await dbAll("SELECT pl.name, COUNT(m.id) as count FROM plans pl LEFT JOIN members m ON pl.id=m.plan_id GROUP BY pl.name");
        const revenueByMonth = await dbAll("SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as total FROM payments WHERE status='Paid' GROUP BY month ORDER BY month DESC LIMIT 6");
        res.json({ totalMembers: totalMembers.count, activeMembers: activeMembers.count, totalTrainers: totalTrainers.count, monthlyRevenue: monthlyRevenue.total, pendingPayments: pendingPayments.count, todayAttendance: todayAttendance.count, expiringPlans: expiringPlans.count, recentPayments, attendanceTrend, planDistribution, revenueByMonth });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── MEMBERS ─────────────────────────────────────────────────
router.get('/members', async (req, res) => {
    try {
        const members = await dbAll(`SELECT m.*, p.name as plan_name, t.username as trainer_username,
            tr.first_name||' '||tr.last_name as trainer_name
            FROM members m LEFT JOIN plans p ON m.plan_id=p.id
            LEFT JOIN users t ON m.trainer_id=t.id
            LEFT JOIN trainers tr ON t.id=tr.user_id
            ORDER BY m.id DESC`);
        res.json(members);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/members/:id', async (req, res) => {
    try {
        const member = await dbGet(`SELECT m.*, p.name as plan_name FROM members m LEFT JOIN plans p ON m.plan_id=p.id WHERE m.id=?`, [req.params.id]);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json(member);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/members', async (req, res) => {
    const { username, password, first_name, last_name, email, phone, gender, date_of_birth, plan_id, trainer_id, status, plan_start_date, plan_end_date, address, emergency_contact, emergency_phone, profile_notes } = req.body;
    try {
        const crypto = require('crypto');
        const generatedPassword = password || crypto.randomBytes(8).toString('hex');
        const hash = await bcrypt.hash(generatedPassword, 10);
        const userRes = await dbRun('INSERT INTO users (username, password_hash, role) VALUES (?, ?, "Member")', [username, hash]);
        await dbRun(`INSERT INTO members (user_id, first_name, last_name, email, phone, gender, date_of_birth, plan_id, trainer_id, status, plan_start_date, plan_end_date, address, emergency_contact, emergency_phone, profile_notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [userRes.lastID, first_name, last_name, email, phone||null, gender||null, date_of_birth||null, plan_id||null, trainer_id||null, status||'Active', plan_start_date||null, plan_end_date||null, address||null, emergency_contact||null, emergency_phone||null, profile_notes||null]);
        const msg = password ? 'Member created successfully.' : `Member created. Temporary password: ${generatedPassword}`;
        res.status(201).json({ message: msg });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ message: 'Username or Email already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.put('/members/:id', async (req, res) => {
    const { first_name, last_name, email, phone, gender, date_of_birth, plan_id, trainer_id, status, plan_start_date, plan_end_date, address, emergency_contact, emergency_phone, profile_notes } = req.body;
    try {
        await dbRun(`UPDATE members SET first_name=?,last_name=?,email=?,phone=?,gender=?,date_of_birth=?,plan_id=?,trainer_id=?,status=?,plan_start_date=?,plan_end_date=?,address=?,emergency_contact=?,emergency_phone=?,profile_notes=? WHERE id=?`,
            [first_name, last_name, email, phone||null, gender||null, date_of_birth||null, plan_id||null, trainer_id||null, status||'Active', plan_start_date||null, plan_end_date||null, address||null, emergency_contact||null, emergency_phone||null, profile_notes||null, req.params.id]);
        res.json({ message: 'Member updated successfully.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/members/:id', async (req, res) => {
    try {
        // FIX: Always delete via user_id cascade OR direct members delete if no user
        const member = await dbGet('SELECT user_id FROM members WHERE id=?', [req.params.id]);
        if (!member) return res.status(404).json({ message: 'Member not found.' });
        if (member.user_id) {
            // Deleting the user cascades to members due to FK ON DELETE CASCADE
            await dbRun('DELETE FROM users WHERE id=?', [member.user_id]);
        } else {
            await dbRun('DELETE FROM members WHERE id=?', [req.params.id]);
        }
        res.json({ message: 'Member deleted successfully.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TRAINERS ─────────────────────────────────────────────────
router.get('/trainers', async (req, res) => {
    try {
        const trainers = await dbAll(`SELECT t.*, u.username, u.created_at as user_created,
            (SELECT COUNT(*) FROM members WHERE trainer_id=t.user_id) as member_count
            FROM trainers t JOIN users u ON t.user_id=u.id ORDER BY t.id DESC`);
        res.json(trainers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/trainers/list', async (req, res) => {
    try {
        const trainers = await dbAll("SELECT u.id, t.first_name||' '||t.last_name as name FROM users u LEFT JOIN trainers t ON u.id=t.user_id WHERE u.role='Trainer'");
        res.json(trainers);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/trainers', async (req, res) => {
    const { username, password, first_name, last_name, email, phone, specialization, bio, experience_years, hourly_rate } = req.body;
    try {
        const hash = await bcrypt.hash(password || 'trainer123', 10);
        const userRes = await dbRun('INSERT INTO users (username, password_hash, role) VALUES (?, ?, "Trainer")', [username, hash]);
        await dbRun('INSERT INTO trainers (user_id, first_name, last_name, email, phone, specialization, bio, experience_years, hourly_rate) VALUES (?,?,?,?,?,?,?,?,?)',
            [userRes.lastID, first_name, last_name, email, phone||null, specialization||null, bio||null, experience_years||0, hourly_rate||0]);
        res.status(201).json({ message: 'Trainer created successfully.' });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) return res.status(400).json({ message: 'Username or Email already exists.' });
        res.status(500).json({ error: err.message });
    }
});

router.put('/trainers/:id', async (req, res) => {
    const { first_name, last_name, email, phone, specialization, bio, experience_years, hourly_rate } = req.body;
    try {
        await dbRun('UPDATE trainers SET first_name=?,last_name=?,email=?,phone=?,specialization=?,bio=?,experience_years=?,hourly_rate=? WHERE id=?',
            [first_name, last_name, email, phone||null, specialization||null, bio||null, experience_years||0, hourly_rate||0, req.params.id]);
        res.json({ message: 'Trainer updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/trainers/:id', async (req, res) => {
    try {
        const trainer = await dbGet('SELECT user_id FROM trainers WHERE id=?', [req.params.id]);
        if (!trainer) return res.status(404).json({ message: 'Trainer not found.' });
        await dbRun('DELETE FROM users WHERE id=?', [trainer.user_id]);
        res.json({ message: 'Trainer deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PLANS ─────────────────────────────────────────────────
router.get('/plans', async (req, res) => {
    try {
        const plans = await dbAll('SELECT p.*, (SELECT COUNT(*) FROM members WHERE plan_id=p.id) as member_count FROM plans p ORDER BY p.price');
        res.json(plans);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/plans', async (req, res) => {
    const { name, price, duration_days, features } = req.body;
    try {
        await dbRun('INSERT INTO plans (name, price, duration_days, features) VALUES (?,?,?,?)', [name, price, duration_days||30, features||'']);
        res.status(201).json({ message: 'Plan created.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/plans/:id', async (req, res) => {
    const { name, price, duration_days, features, is_active } = req.body;
    try {
        await dbRun('UPDATE plans SET name=?,price=?,duration_days=?,features=?,is_active=? WHERE id=?', [name, price, duration_days||30, features||'', is_active===false?0:1, req.params.id]);
        res.json({ message: 'Plan updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/plans/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM plans WHERE id=?', [req.params.id]);
        res.json({ message: 'Plan deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PAYMENTS ─────────────────────────────────────────────────
router.get('/payments', async (req, res) => {
    try {
        const payments = await dbAll(`SELECT p.*, m.first_name||' '||m.last_name as member_name, pl.name as plan_name
            FROM payments p LEFT JOIN members m ON p.member_id=m.id LEFT JOIN plans pl ON p.plan_id=pl.id ORDER BY p.payment_date DESC`);
        res.json(payments);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/payments', async (req, res) => {
    const { member_id, plan_id, amount, method, status, due_date, notes } = req.body;
    const receipt_no = 'RCP-' + Date.now();
    try {
        await dbRun('INSERT INTO payments (member_id, plan_id, amount, method, status, due_date, notes, receipt_no) VALUES (?,?,?,?,?,?,?,?)',
            [member_id, plan_id||null, amount, method||'Cash', status||'Paid', due_date||null, notes||null, receipt_no]);
        res.status(201).json({ message: 'Payment recorded.', receipt_no });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/payments/:id', async (req, res) => {
    const { amount, method, status, due_date, notes } = req.body;
    try {
        await dbRun('UPDATE payments SET amount=?,method=?,status=?,due_date=?,notes=? WHERE id=?', [amount, method, status, due_date||null, notes||null, req.params.id]);
        res.json({ message: 'Payment updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/payments/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM payments WHERE id=?', [req.params.id]);
        res.json({ message: 'Payment deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EQUIPMENT ─────────────────────────────────────────────────
router.get('/equipment', async (req, res) => {
    try {
        const equipment = await dbAll('SELECT * FROM equipment ORDER BY category, name');
        res.json(equipment);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/equipment', async (req, res) => {
    const { name, category, brand, quantity, condition, purchase_date, last_maintenance, next_maintenance, notes } = req.body;
    try {
        await dbRun('INSERT INTO equipment (name, category, brand, quantity, condition, purchase_date, last_maintenance, next_maintenance, notes) VALUES (?,?,?,?,?,?,?,?,?)',
            [name, category, brand||null, quantity||1, condition||'Good', purchase_date||null, last_maintenance||null, next_maintenance||null, notes||null]);
        res.status(201).json({ message: 'Equipment added.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/equipment/:id', async (req, res) => {
    const { name, category, brand, quantity, condition, purchase_date, last_maintenance, next_maintenance, notes } = req.body;
    try {
        await dbRun('UPDATE equipment SET name=?,category=?,brand=?,quantity=?,condition=?,purchase_date=?,last_maintenance=?,next_maintenance=?,notes=? WHERE id=?',
            [name, category, brand||null, quantity||1, condition||'Good', purchase_date||null, last_maintenance||null, next_maintenance||null, notes||null, req.params.id]);
        res.json({ message: 'Equipment updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/equipment/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM equipment WHERE id=?', [req.params.id]);
        res.json({ message: 'Equipment deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CLASSES ─────────────────────────────────────────────────
router.get('/classes', async (req, res) => {
    try {
        const classes = await dbAll(`SELECT c.*, t.first_name||' '||t.last_name as trainer_name,
            (SELECT COUNT(*) FROM class_enrollments WHERE class_id=c.id) as enrolled_count
            FROM classes c LEFT JOIN trainers t ON c.trainer_id=t.user_id ORDER BY c.schedule_day, c.start_time`);
        res.json(classes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/classes', async (req, res) => {
    const { name, trainer_id, schedule_day, start_time, end_time, capacity, category, description } = req.body;
    try {
        await dbRun('INSERT INTO classes (name, trainer_id, schedule_day, start_time, end_time, capacity, category, description) VALUES (?,?,?,?,?,?,?,?)',
            [name, trainer_id||null, schedule_day, start_time, end_time, capacity||20, category||null, description||null]);
        res.status(201).json({ message: 'Class created.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/classes/:id', async (req, res) => {
    const { name, trainer_id, schedule_day, start_time, end_time, capacity, category, description, is_active } = req.body;
    try {
        await dbRun('UPDATE classes SET name=?,trainer_id=?,schedule_day=?,start_time=?,end_time=?,capacity=?,category=?,description=?,is_active=? WHERE id=?',
            [name, trainer_id||null, schedule_day, start_time, end_time, capacity||20, category||null, description||null, is_active===false?0:1, req.params.id]);
        res.json({ message: 'Class updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/classes/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM classes WHERE id=?', [req.params.id]);
        res.json({ message: 'Class deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ATTENDANCE (Admin View) ───────────────────────────────────
router.get('/attendance', async (req, res) => {
    try {
        const records = await dbAll(`SELECT a.*, m.first_name||' '||m.last_name as member_name
            FROM attendance a LEFT JOIN members m ON a.member_id=m.id ORDER BY a.check_in_time DESC LIMIT 100`);
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/attendance', async (req, res) => {
    const { member_id, check_in_time, notes } = req.body;
    try {
        await dbRun('INSERT INTO attendance (member_id, check_in_time, notes) VALUES (?,?,?)', [member_id, check_in_time||null, notes||null]);
        res.status(201).json({ message: 'Attendance recorded.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/attendance/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM attendance WHERE id=?', [req.params.id]);
        res.json({ message: 'Record deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────────
router.get('/announcements', async (req, res) => {
    try {
        const ann = await dbAll('SELECT a.*, u.username as created_by_name FROM announcements a LEFT JOIN users u ON a.created_by=u.id ORDER BY a.created_at DESC');
        res.json(ann);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/announcements', async (req, res) => {
    const { title, body, audience, expires_at } = req.body;
    try {
        await dbRun('INSERT INTO announcements (title, body, audience, created_by, expires_at) VALUES (?,?,?,?,?)',
            [title, body, audience||'All', req.user.id, expires_at||null]);
        res.status(201).json({ message: 'Announcement posted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/announcements/:id', async (req, res) => {
    const { title, body, audience, expires_at } = req.body;
    try {
        await dbRun('UPDATE announcements SET title=?,body=?,audience=?,expires_at=? WHERE id=?', [title, body, audience||'All', expires_at||null, req.params.id]);
        res.json({ message: 'Announcement updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/announcements/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM announcements WHERE id=?', [req.params.id]);
        res.json({ message: 'Announcement deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DB VIEWER ─────────────────────────────────────────────────
// FIX: These routes were placed AFTER module.exports = router and were unreachable.
// Moved above module.exports so they are properly registered.
router.get('/db/tables', async (req, res) => {
    try {
        const tables = await dbAll("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        res.json(tables.map(t => t.name));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/db/table/:name', async (req, res) => {
    const allowed = /^[a-zA-Z_]+$/.test(req.params.name);
    if (!allowed) return res.status(400).json({ message: 'Invalid table name' });
    try {
        const rows = await dbAll(`SELECT * FROM ${req.params.name} ORDER BY rowid DESC LIMIT 200`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/db/query', async (req, res) => {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ message: 'SQL required' });
    if (!sql.trim().toUpperCase().startsWith('SELECT')) return res.status(400).json({ message: 'Only SELECT queries allowed' });
    const ALLOWED_TABLES = ['members','trainers','plans','payments','classes','attendance','equipment','announcements','class_enrollments','workouts','body_metrics','goals'];
    const tablesUsed = [...sql.matchAll(/(?:FROM|JOIN)\s+([a-zA-Z_]+)/gi)].map(m => m[1].toLowerCase());
    const blocked = tablesUsed.filter(t => !ALLOWED_TABLES.includes(t));
    if (blocked.length > 0) return res.status(403).json({ message: `Query touches restricted table(s): ${blocked.join(', ')}` });
    try {
        const rows = await dbAll(sql);
        res.json(rows);
    } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── CLEAR DATABASE ────────────────────────────────────────────
router.post('/db/clear', async (req, res) => {
    try {
        // Delete all non-admin data while keeping admin user
        await dbRun('DELETE FROM class_enrollments');
        await dbRun('DELETE FROM attendance');
        await dbRun('DELETE FROM payments');
        await dbRun('DELETE FROM workouts');
        await dbRun('DELETE FROM body_metrics');
        await dbRun('DELETE FROM goals');
        await dbRun('DELETE FROM announcements');
        await dbRun('DELETE FROM classes');
        await dbRun('DELETE FROM equipment');
        // Delete member users (not admin/trainer)
        await dbRun("DELETE FROM users WHERE role='Member'");
        // Delete trainers and their users
        await dbRun("DELETE FROM users WHERE role='Trainer'");
        // Delete plans
        await dbRun('DELETE FROM plans');
        res.json({ message: 'Database cleared. Admin account preserved.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

const express = require('express');
const { dbGet, dbRun, dbAll } = require('../database');
const { authenticateToken, isMember } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authenticateToken, isMember);

// ── PROFILE ────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
    try {
        const profile = await dbGet(`SELECT m.*, p.name as plan_name, p.features as plan_features, p.price as plan_price,
            t.first_name||' '||t.last_name as trainer_name, t.specialization as trainer_specialization
            FROM members m LEFT JOIN plans p ON m.plan_id=p.id
            LEFT JOIN trainers t ON m.trainer_id=t.user_id
            WHERE m.user_id=?`, [req.user.id]);
        res.json(profile || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', async (req, res) => {
    const { phone, address, emergency_contact, emergency_phone } = req.body;
    try {
        await dbRun('UPDATE members SET phone=?,address=?,emergency_contact=?,emergency_phone=? WHERE user_id=?',
            [phone||null, address||null, emergency_contact||null, emergency_phone||null, req.user.id]);
        res.json({ message: 'Profile updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ATTENDANCE ─────────────────────────────────────────────
router.post('/attendance', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.status(404).json({ message: 'Profile not found' });
        await dbRun('INSERT INTO attendance (member_id) VALUES (?)', [member.id]);
        res.json({ message: 'Checked in successfully!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attendance', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.json([]);
        const records = await dbAll('SELECT * FROM attendance WHERE member_id=? ORDER BY check_in_time DESC LIMIT 60', [member.id]);
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── WORKOUTS ───────────────────────────────────────────────
router.get('/workouts', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.json([]);
        const workouts = await dbAll('SELECT * FROM workouts WHERE member_id=? ORDER BY day, id', [member.id]);
        res.json(workouts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BODY METRICS ───────────────────────────────────────────
router.get('/metrics', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.json([]);
        const metrics = await dbAll('SELECT * FROM body_metrics WHERE member_id=? ORDER BY recorded_date DESC', [member.id]);
        res.json(metrics);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/metrics', async (req, res) => {
    const { recorded_date, weight_kg, height_cm, body_fat_pct, muscle_mass_kg, bmi, chest_cm, waist_cm, hips_cm, bicep_cm, notes } = req.body;
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.status(404).json({ message: 'Profile not found' });
        await dbRun(`INSERT INTO body_metrics (member_id, recorded_date, weight_kg, height_cm, body_fat_pct, muscle_mass_kg, bmi, chest_cm, waist_cm, hips_cm, bicep_cm, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [member.id, recorded_date||null, weight_kg||null, height_cm||null, body_fat_pct||null, muscle_mass_kg||null, bmi||null, chest_cm||null, waist_cm||null, hips_cm||null, bicep_cm||null, notes||null]);
        res.status(201).json({ message: 'Metrics saved.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GOALS ─────────────────────────────────────────────────
router.get('/goals', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.json([]);
        const goals = await dbAll('SELECT * FROM goals WHERE member_id=? ORDER BY created_at DESC', [member.id]);
        res.json(goals);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/goals', async (req, res) => {
    const { title, description, target_date } = req.body;
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.status(404).json({ message: 'Profile not found' });
        await dbRun('INSERT INTO goals (member_id, title, description, target_date) VALUES (?,?,?,?)',
            [member.id, title, description||null, target_date||null]);
        res.status(201).json({ message: 'Goal added.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/goals/:id', async (req, res) => {
    const { title, description, target_date, status } = req.body;
    try {
        await dbRun('UPDATE goals SET title=?,description=?,target_date=?,status=? WHERE id=?',
            [title, description||null, target_date||null, status||'Active', req.params.id]);
        res.json({ message: 'Goal updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/goals/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM goals WHERE id=?', [req.params.id]);
        res.json({ message: 'Goal deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CLASSES ────────────────────────────────────────────────
router.get('/classes', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        const classes = await dbAll(`SELECT c.*, t.first_name||' '||t.last_name as trainer_name,
            (SELECT COUNT(*) FROM class_enrollments WHERE class_id=c.id) as enrolled_count,
            CASE WHEN EXISTS(SELECT 1 FROM class_enrollments WHERE class_id=c.id AND member_id=?) THEN 1 ELSE 0 END as is_enrolled
            FROM classes c LEFT JOIN trainers t ON c.trainer_id=t.user_id WHERE c.is_active=1 ORDER BY c.schedule_day, c.start_time`,
            [member ? member.id : 0]);
        res.json(classes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/classes/:id/enroll', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.status(404).json({ message: 'Profile not found' });
        const cls = await dbGet('SELECT * FROM classes WHERE id=?', [req.params.id]);
        if (!cls) return res.status(404).json({ message: 'Class not found' });
        const enrolled = await dbGet('SELECT COUNT(*) as count FROM class_enrollments WHERE class_id=?', [req.params.id]);
        if (enrolled.count >= cls.capacity) return res.status(400).json({ message: 'Class is full' });
        await dbRun('INSERT OR IGNORE INTO class_enrollments (class_id, member_id) VALUES (?,?)', [req.params.id, member.id]);
        res.json({ message: 'Enrolled successfully!' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/classes/:id/enroll', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.status(404).json({ message: 'Profile not found' });
        await dbRun('DELETE FROM class_enrollments WHERE class_id=? AND member_id=?', [req.params.id, member.id]);
        res.json({ message: 'Unenrolled.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PAYMENTS ──────────────────────────────────────────────
router.get('/payments', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE user_id=?', [req.user.id]);
        if (!member) return res.json([]);
        const payments = await dbAll('SELECT p.*, pl.name as plan_name FROM payments p LEFT JOIN plans pl ON p.plan_id=pl.id WHERE p.member_id=? ORDER BY p.payment_date DESC', [member.id]);
        res.json(payments);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────
router.get('/announcements', async (req, res) => {
    try {
        const ann = await dbAll("SELECT * FROM announcements WHERE audience IN ('All','Members') ORDER BY created_at DESC LIMIT 10");
        res.json(ann);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

const express = require('express');
const { dbAll, dbRun, dbGet } = require('../database');
const { authenticateToken, isTrainer } = require('../middleware/authMiddleware');
const router = express.Router();

router.use(authenticateToken, isTrainer);

// ── PROFILE ────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
    try {
        const profile = await dbGet('SELECT t.*, u.username FROM trainers t JOIN users u ON t.user_id=u.id WHERE t.user_id=?', [req.user.id]);
        res.json(profile || {});
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/profile', async (req, res) => {
    const { first_name, last_name, email, phone, specialization, bio, experience_years } = req.body;
    try {
        await dbRun('UPDATE trainers SET first_name=?,last_name=?,email=?,phone=?,specialization=?,bio=?,experience_years=? WHERE user_id=?',
            [first_name, last_name, email, phone||null, specialization||null, bio||null, experience_years||0, req.user.id]);
        res.json({ message: 'Profile updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ASSIGNED MEMBERS ───────────────────────────────────────
router.get('/members', async (req, res) => {
    try {
        const members = await dbAll(`SELECT m.*, p.name as plan_name FROM members m
            LEFT JOIN plans p ON m.plan_id=p.id WHERE m.trainer_id=? ORDER BY m.first_name`, [req.user.id]);
        res.json(members);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/members/:id/attendance', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE id=? AND trainer_id=?', [req.params.id, req.user.id]);
        if (!member) return res.status(403).json({ message: 'Not authorized' });
        const records = await dbAll('SELECT * FROM attendance WHERE member_id=? ORDER BY check_in_time DESC LIMIT 30', [req.params.id]);
        res.json(records);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/members/:id/metrics', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE id=? AND trainer_id=?', [req.params.id, req.user.id]);
        if (!member) return res.status(403).json({ message: 'Not authorized' });
        const metrics = await dbAll('SELECT * FROM body_metrics WHERE member_id=? ORDER BY recorded_date DESC', [req.params.id]);
        res.json(metrics);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── WORKOUTS ───────────────────────────────────────────────
router.get('/workouts', async (req, res) => {
    try {
        const workouts = await dbAll(`SELECT w.*, m.first_name||' '||m.last_name as member_name
            FROM workouts w JOIN members m ON w.member_id=m.id WHERE m.trainer_id=? ORDER BY w.created_at DESC`, [req.user.id]);
        res.json(workouts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/members/:id/workouts', async (req, res) => {
    try {
        const member = await dbGet('SELECT id FROM members WHERE id=? AND trainer_id=?', [req.params.id, req.user.id]);
        if (!member) return res.status(403).json({ message: 'Not authorized' });
        const workouts = await dbAll('SELECT * FROM workouts WHERE member_id=? ORDER BY day, created_at', [req.params.id]);
        res.json(workouts);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/workouts', async (req, res) => {
    const { member_id, day, workout_name, sets, reps, weight, duration_mins, notes } = req.body;
    try {
        const member = await dbGet('SELECT id FROM members WHERE id=? AND trainer_id=?', [member_id, req.user.id]);
        if (!member) return res.status(403).json({ message: 'Not authorized for this member' });
        await dbRun('INSERT INTO workouts (member_id, trainer_id, day, workout_name, sets, reps, weight, duration_mins, notes) VALUES (?,?,?,?,?,?,?,?,?)',
            [member_id, req.user.id, day, workout_name, sets||null, reps||null, weight||null, duration_mins||null, notes||null]);
        res.status(201).json({ message: 'Workout added.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/workouts/:id', async (req, res) => {
    const { day, workout_name, sets, reps, weight, duration_mins, notes } = req.body;
    try {
        await dbRun('UPDATE workouts SET day=?,workout_name=?,sets=?,reps=?,weight=?,duration_mins=?,notes=? WHERE id=? AND trainer_id=?',
            [day, workout_name, sets||null, reps||null, weight||null, duration_mins||null, notes||null, req.params.id, req.user.id]);
        res.json({ message: 'Workout updated.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/workouts/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM workouts WHERE id=? AND trainer_id=?', [req.params.id, req.user.id]);
        res.json({ message: 'Workout deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── BODY METRICS (Trainer adds for member) ─────────────────
router.post('/metrics', async (req, res) => {
    const { member_id, recorded_date, weight_kg, height_cm, body_fat_pct, muscle_mass_kg, bmi, chest_cm, waist_cm, hips_cm, bicep_cm, notes } = req.body;
    try {
        const member = await dbGet('SELECT id FROM members WHERE id=? AND trainer_id=?', [member_id, req.user.id]);
        if (!member) return res.status(403).json({ message: 'Not authorized' });
        await dbRun(`INSERT INTO body_metrics (member_id, recorded_date, weight_kg, height_cm, body_fat_pct, muscle_mass_kg, bmi, chest_cm, waist_cm, hips_cm, bicep_cm, notes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [member_id, recorded_date||null, weight_kg||null, height_cm||null, body_fat_pct||null, muscle_mass_kg||null, bmi||null, chest_cm||null, waist_cm||null, hips_cm||null, bicep_cm||null, notes||null]);
        res.status(201).json({ message: 'Metrics recorded.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/metrics/:id', async (req, res) => {
    try {
        await dbRun('DELETE FROM body_metrics WHERE id=?', [req.params.id]);
        res.json({ message: 'Metric deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CLASSES (trainer's own classes) ───────────────────────
router.get('/classes', async (req, res) => {
    try {
        const classes = await dbAll(`SELECT c.*, (SELECT COUNT(*) FROM class_enrollments WHERE class_id=c.id) as enrolled_count
            FROM classes c WHERE c.trainer_id=? ORDER BY c.schedule_day, c.start_time`, [req.user.id]);
        res.json(classes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/classes/:id/enrollments', async (req, res) => {
    try {
        const enrollments = await dbAll(`SELECT ce.*, m.first_name||' '||m.last_name as member_name, m.email, m.phone
            FROM class_enrollments ce JOIN members m ON ce.member_id=m.id WHERE ce.class_id=?`, [req.params.id]);
        res.json(enrollments);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────
router.get('/announcements', async (req, res) => {
    try {
        const ann = await dbAll("SELECT * FROM announcements WHERE audience IN ('All','Trainers') ORDER BY created_at DESC");
        res.json(ann);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

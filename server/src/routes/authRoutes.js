const router = require('express').Router();
const c = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/signup', c.signup);
router.post('/login', c.login);
router.post('/logout', c.logout);
router.get('/me', requireAuth, c.me);
router.patch('/settings', requireAuth, c.updateSettings);
router.get('/templates', requireAuth, c.listTemplates);
router.put('/templates', requireAuth, c.saveTemplate);

module.exports = router;

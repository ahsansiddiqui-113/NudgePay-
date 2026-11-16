const router = require('express').Router();
const c = require('../controllers/invoiceController');
const { requireAuth } = require('../middleware/authMiddleware');

router.use(requireAuth);
router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.post('/:id/paid', c.markPaid);
router.post('/:id/pause', c.setPaused);
router.delete('/:id', c.remove);

module.exports = router;

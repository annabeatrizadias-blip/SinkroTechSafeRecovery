const express = require('express');
const c = require('../controllers/ocorrenciaController');

const router = express.Router();

router.get('/status', c.status);

router.post('/ocorrencias', c.criar);
router.get('/ocorrencias/ativas', c.ativas);       // antes de /:id
router.get('/ocorrencias/historico', c.historico); // antes de /:id
router.put('/ocorrencias/:id/resgate', c.resgate);
router.delete('/ocorrencias/:id', c.arquivar);

module.exports = router;
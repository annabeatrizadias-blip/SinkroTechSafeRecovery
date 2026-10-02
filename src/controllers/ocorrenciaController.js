const Ocorrencia = require('../models/OcorrenciaModel');
const clp = require('../services/clpSimulator');
const { getIo } = require('../config/socket');

const ocorrenciaController = {
  // POST /api/ocorrencias  (acionado pelo CLP / simulador)
  criar(req, res) {
    const { sensor_id } = req.body || {};
    if (sensor_id && !clp.SENSORES[sensor_id]) {
      return res.status(400).json({ erro: 'sensor_id inválido. Use S01, S02, S03 ou MANUAL.' });
    }
    const { criada, ocorrencia } = clp.registrarFalha(sensor_id);
    if (!criada) {
      return res.status(409).json({ erro: 'A linha já está em MODO_DESCANSO.', ocorrencia });
    }
    res.status(201).json(ocorrencia);
  },

  // GET /api/ocorrencias/ativas
  ativas(req, res) {
    const ativa = Ocorrencia.buscarAtiva();
    if (!ativa) return res.json({ ativa: false });
    res.json({ ativa: true, ...clp.montarAlerta(ativa) });
  },

  // GET /api/ocorrencias/historico
  historico(req, res) {
    res.json({
      metricas: Ocorrencia.metricas(),
      ocorrencias: Ocorrencia.historico(),
    });
  },

  // PUT /api/ocorrencias/:id/resgate
  resgate(req, res) {
    const id = Number(req.params.id);
    const { tecnico_nome, tecnico_matricula, nr12_aceite } = req.body || {};

    if (!tecnico_nome || !String(tecnico_nome).trim() ||
        !tecnico_matricula || !String(tecnico_matricula).trim()) {
      return res.status(400).json({ erro: 'Nome e matrícula do técnico são obrigatórios.' });
    }
    if (nr12_aceite !== true) {
      return res.status(400).json({ erro: 'É obrigatório confirmar o cumprimento da NR-12.' });
    }

    const oc = Ocorrencia.buscarPorId(id);
    if (!oc) return res.status(404).json({ erro: 'Ocorrência não encontrada.' });
    if (oc.status !== 'ATIVA') {
      return res.status(409).json({ erro: 'Esta ocorrência já foi resolvida.' });
    }

    const resolvida = Ocorrencia.resgatar(id, {
      tecnico_nome: String(tecnico_nome).trim(),
      tecnico_matricula: String(tecnico_matricula).trim(),
    });

    const comando = clp.liberarLinha(); // "LINHA_LIBERADA"

    const io = getIo();
    io.emit('linha_liberada', { ocorrencia: resolvida });
    io.emit('historico_atualizado');

    res.json({ comando, ocorrencia: resolvida });
  },

  // DELETE /api/ocorrencias/:id  (soft-delete)
  arquivar(req, res) {
    const id = Number(req.params.id);
    const oc = Ocorrencia.buscarPorId(id);
    if (!oc) return res.status(404).json({ erro: 'Ocorrência não encontrada.' });
    if (oc.status === 'ATIVA') {
      return res.status(409).json({ erro: 'Não é possível arquivar uma ocorrência ativa.' });
    }
    Ocorrencia.arquivar(id);
    getIo().emit('historico_atualizado');
    res.json({ arquivado: true, id });
  },

  // GET /api/status
  status(req, res) {
    res.json(clp.getEstado());
  },
};

module.exports = ocorrenciaController;
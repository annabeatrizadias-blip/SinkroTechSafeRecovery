const db = require('../config/database');

const agora = () => new Date().toISOString();

const OcorrenciaModel = {
  criar({ sensor_id, sensor_nome, tipo_sensor, causa_provavel, valor_lido, limite }) {
    const info = db
      .prepare(
        `INSERT INTO ocorrencias
           (sensor_id, sensor_nome, tipo_sensor, causa_provavel, valor_lido, limite, status, inicio_em)
         VALUES (?, ?, ?, ?, ?, ?, 'ATIVA', ?)`
      )
      .run(sensor_id, sensor_nome, tipo_sensor, causa_provavel, valor_lido, limite, agora());
    return OcorrenciaModel.buscarPorId(info.lastInsertRowid);
  },

  buscarPorId(id) {
    return db.prepare('SELECT * FROM ocorrencias WHERE id = ?').get(id);
  },

  buscarAtiva() {
    return db
      .prepare(
        `SELECT * FROM ocorrencias
         WHERE status = 'ATIVA' AND arquivado = 0
         ORDER BY id DESC LIMIT 1`
      )
      .get();
  },

  historico(limite = 200) {
    return db
      .prepare('SELECT * FROM ocorrencias WHERE arquivado = 0 ORDER BY id DESC LIMIT ?')
      .all(limite);
  },

  historicoPorSensor(sensorId, excluirId, limite = 5) {
    return db
      .prepare(
        `SELECT id, inicio_em, fim_em, duracao_segundos, status, tecnico_nome
         FROM ocorrencias
         WHERE sensor_id = ? AND id <> ? AND arquivado = 0
         ORDER BY id DESC LIMIT ?`
      )
      .all(sensorId, excluirId, limite);
  },

  resgatar(id, { tecnico_nome, tecnico_matricula }) {
    const atual = OcorrenciaModel.buscarPorId(id);
    const fim = agora();
    const duracao = Math.max(0, Math.round((Date.parse(fim) - Date.parse(atual.inicio_em)) / 1000));

    db.prepare(
      `UPDATE ocorrencias
       SET status = 'RESOLVIDO', fim_em = ?, duracao_segundos = ?,
           tecnico_nome = ?, tecnico_matricula = ?, nr12_aceite = 1
       WHERE id = ?`
    ).run(fim, duracao, tecnico_nome, tecnico_matricula, id);

    return OcorrenciaModel.buscarPorId(id);
  },

  arquivar(id) {
    return db.prepare('UPDATE ocorrencias SET arquivado = 1 WHERE id = ?').run(id).changes > 0;
  },

  metricas() {
    return db
      .prepare(
        `SELECT COUNT(*)                         AS total_resolvidas,
                ROUND(AVG(duracao_segundos), 1)  AS mttr_segundos
         FROM ocorrencias
         WHERE status = 'RESOLVIDO' AND arquivado = 0`
      )
      .get();
  },
};

module.exports = OcorrenciaModel;
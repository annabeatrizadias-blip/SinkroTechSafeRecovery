const Ocorrencia = require('../models/OcorrenciaModel');
const { getIo } = require('../config/socket');

// Os 3 sensores da célula de montagem
const SENSORES = {
  S01: {
    id: 'S01',
    nome: 'Sensor Óptico 01 - Copo Plástico',
    tipo: 'OPTICO',
    local: 'Posição de presença do copo plástico',
    unidade: '%',
    limite: 80,
    valorFalha: 42,
    causas: [
      'Copo plástico mal posicionado ou deformado',
      'Lente do sensor óptico suja ou desalinhada',
      'Atraso de alimentação de copos na esteira',
    ],
  },
  S02: {
    id: 'S02',
    nome: 'Sensor Indutivo 02 - Esteira',
    tipo: 'INDUTIVO',
    local: 'Velocidade / frenagem da esteira',
    unidade: 'm/s',
    limite: 0.5,
    valorFalha: 0.74,
    causas: [
      'Desaceleração mecânica superior ao limite seguro (esteira desliza por inércia)',
      'Desgaste do freio ou da correia do motor da esteira',
      'Variação de carga sobre a esteira',
    ],
  },
  S03: {
    id: 'S03',
    nome: 'Sensor Indutivo 03 - Braço Robótico',
    tipo: 'INDUTIVO',
    local: 'Posição do braço robótico',
    unidade: 'mm',
    limite: 2,
    valorFalha: 6.8,
    causas: [
      'Braço robótico fora da posição de referência (home)',
      'Folga mecânica na articulação',
      'Perda de sincronismo entre robô e esteira',
    ],
  },
    MANUAL: {
    id: 'MANUAL',
    nome: 'Acionamento Manual - Operador',
    tipo: 'MANUAL',
    local: 'Botão de Resgate acionado pelo operador da máquina',
    unidade: '',
    limite: null,
    valorFalha: null,
    causas: [
      'Parada preventiva solicitada pelo operador',
      'Anomalia percebida visualmente na esteira ou no braço robótico',
      'Inspeção ou ajuste mecânico necessário antes de retomar a produção',
    ],
  },
};

const estado = {
  status: 'OPERANDO', // OPERANDO | MODO_DESCANSO
  sensorFalha: null,
  pecas: 0,
  oee: 92.0,
};

function getEstado() {
  return { ...estado };
}

function montarAlerta(ocorrencia) {
  const s = SENSORES[ocorrencia.sensor_id];
  return {
    ocorrencia,
    sensor: s
      ? { id: s.id, nome: s.nome, tipo: s.tipo, local: s.local, unidade: s.unidade, causas: s.causas }
      : { id: ocorrencia.sensor_id, nome: ocorrencia.sensor_nome, causas: [] },
    historico_sensor: Ocorrencia.historicoPorSensor(ocorrencia.sensor_id, ocorrencia.id, 5),
  };
}

/** Simula o CLP detectando a quebra de intertravamento. */
function registrarFalha(sensorId) {
  if (estado.status === 'MODO_DESCANSO') {
    return { criada: false, ocorrencia: Ocorrencia.buscarAtiva() };
  }

  const s = SENSORES[sensorId] || SENSORES.S02;
  const ocorrencia = Ocorrencia.criar({
    sensor_id: s.id,
    sensor_nome: s.nome,
    tipo_sensor: s.tipo,
    causa_provavel: s.causas[0],
    valor_lido: s.valorFalha,
    limite: s.limite,
  });

  estado.status = 'MODO_DESCANSO';
  estado.sensorFalha = s.id;
  estado.oee = Math.max(0, estado.oee - 8);

  const io = getIo();
  io.emit('estado_linha', getEstado());
  io.emit('alerta_falha', montarAlerta(ocorrencia));
  io.emit('historico_atualizado');

  return { criada: true, ocorrencia };
}

/** Handshake de volta ao CLP após o Botão de Resgate. */
function liberarLinha() {
  estado.status = 'OPERANDO';
  estado.sensorFalha = null;

  const io = getIo();
  io.emit('estado_linha', getEstado());
  return 'LINHA_LIBERADA';
}

/** Leituras periódicas (peças montadas e OEE) enquanto a linha opera. */
function iniciarTelemetria() {
  setInterval(() => {
    if (estado.status !== 'OPERANDO') return;
    estado.pecas += 1;
    estado.oee = Math.min(98, Math.max(85, estado.oee + (Math.random() - 0.4)));
    getIo().emit('estado_linha', getEstado());
  }, 2000);
}

module.exports = {
  SENSORES,
  getEstado,
  montarAlerta,
  registrarFalha,
  liberarLinha,
  iniciarTelemetria,
};
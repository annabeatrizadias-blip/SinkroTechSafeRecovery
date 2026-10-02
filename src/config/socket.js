const { Server } = require('socket.io');
const Ocorrencia = require('../models/OcorrenciaModel');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer);

  io.on('connection', (socket) => {
    // require tardio para evitar dependência circular
    const clp = require('../services/clpSimulator');

    // Quem conecta (ou recarrega a página) já recebe o estado atual
    socket.emit('estado_linha', clp.getEstado());

    const ativa = Ocorrencia.buscarAtiva();
    if (ativa) socket.emit('alerta_falha', clp.montarAlerta(ativa));
  });

  return io;
}

function getIo() {
  if (!io) throw new Error('Socket.io ainda não foi inicializado');
  return io;
}

module.exports = { initSocket, getIo };
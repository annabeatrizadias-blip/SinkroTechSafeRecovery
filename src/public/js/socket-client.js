// Recebe os eventos do backend e os repassa como CustomEvents,
// para que dashboard.js e resgate-modal.js fiquem desacoplados.
const socket = io();

['estado_linha', 'alerta_falha', 'linha_liberada', 'historico_atualizado'].forEach((nome) => {
  socket.on(nome, (dados) => {
    document.dispatchEvent(new CustomEvent(nome, { detail: dados }));
  });
});

socket.on('connect', () => document.dispatchEvent(new CustomEvent('conexao', { detail: true })));
socket.on('disconnect', () => document.dispatchEvent(new CustomEvent('conexao', { detail: false })));
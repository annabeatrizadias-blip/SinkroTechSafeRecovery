require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');

const { initSocket } = require('./config/socket');
const ocorrenciaRoutes = require('./routes/ocorrenciaRoutes');
const clp = require('./services/clpSimulator');

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', ocorrenciaRoutes);

initSocket(server);
clp.iniciarTelemetria();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🏭 Painel Lorenzetti rodando em http://localhost:${PORT}`);
});
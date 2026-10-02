(() => {
  const $ = (id) => document.getElementById(id);

  const esc = (v) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fmtDuracao = (s) => {
    if (s == null) return '--';
    const m = Math.floor(s / 60);
    const seg = Math.round(s % 60);
    return `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  };

  const fmtData = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '--');

  window.Util = { $, esc, fmtDuracao, fmtData };

  // ---------- Toasts ----------
  function toast(msg, tipo = 'ok') {
    const cor = tipo === 'erro' ? 'bg-red-600' : 'bg-emerald-600';
    const div = document.createElement('div');
    div.className = `${cor} text-white text-sm px-4 py-3 rounded-lg shadow-lg fade-in`;
    div.textContent = msg;
    $('toasts').appendChild(div);
    setTimeout(() => div.remove(), 4500);
  }
  window.Util.toast = toast;

  // ---------- Estado ----------
  let estado = null;
  let inicioFalha = null;
  let cache = [];
  let emAlerta = new Set();

  const TEMAS = {
    ok:     { cls: 'from-emerald-600 to-emerald-800', txt: '● OPERANDO' },
    alerta: { cls: 'from-amber-500 to-amber-700',     txt: '● ALERTA PREDITIVO' },
    falha:  { cls: 'from-red-600 to-red-900',         txt: '● MODO DE DESCANSO' },
  };

  // 1) NOMES incluindo acionamento manual
  const NOMES = {
    S01: 'S01 Óptico (copo)',
    S02: 'S02 Indutivo (esteira)',
    S03: 'S03 Indutivo (braço)',
    MANUAL: 'Acionamento manual',
  };

  function render() {
    if (!estado) return;
    const falha = estado.status === 'MODO_DESCANSO';
    const tema = falha ? 'falha' : emAlerta.size ? 'alerta' : 'ok';

    $('status-banner').className =
      `rounded-2xl p-6 bg-gradient-to-br ${TEMAS[tema].cls} text-white shadow-lg transition-all ${falha ? 'alerta-piscante' : ''}`;
    $('status-texto').textContent = TEMAS[tema].txt;
    
    // O texto exibe NOMES[estado.sensorFalha] automaticamente para acionamento manual
    $('status-sub').textContent = falha
      ? `Linha parada. Sensor com desvio: ${NOMES[estado.sensorFalha] || estado.sensorFalha}.`
      : emAlerta.size
        ? `Desgaste recorrente em: ${[...emAlerta].map((s) => NOMES[s] || s).join(', ')}. Programe inspeção.`
        : 'Linha sincronizada. Nenhuma anomalia detectada.';

    $('bloco-timer').classList.toggle('hidden', !falha);$('m-oee').textContent = `${Number(estado.oee).toFixed(1)}%`;
    $('m-pecas').textContent = estado.pecas;

    ['S01', 'S02', 'S03'].forEach((id) => {
      const c = $(`sensor-${id}`);
      if (!c) return;
      const emFalha = falha && estado.sensorFalha === id;
      c.setAttribute('fill', emFalha ? '#dc2626' : emAlerta.has(id) ? '#f59e0b' : '#16a34a');
      c.setAttribute('class', emFalha || (!falha && emAlerta.has(id)) ? 'sensor-pisca' : '');
    });
  }

  setInterval(() => {
    if (inicioFalha) $('timer-parada').textContent = fmtDuracao((Date.now() - inicioFalha) / 1000);
  }, 1000);

  // ---------- Histórico ----------
  // 2) Ignora acionamentos manuais no cálculo do alerta preditivo
  function calcularAlertas(ocorrencias) {
    const limite = Date.now() - 7 * 24 * 3600 * 1000;
    const cont = {};
    ocorrencias.forEach((o) => {
      if (o.sensor_id === 'MANUAL') return;
      if (Date.parse(o.inicio_em) >= limite) cont[o.sensor_id] = (cont[o.sensor_id] || 0) + 1;
    });
    emAlerta = new Set(Object.keys(cont).filter((k) => cont[k] >= 3));
  }

  async function carregarHistorico() {
    const r = await fetch('/api/ocorrencias/historico');
    const { metricas, ocorrencias } = await r.json();
    cache = ocorrencias;

    $('m-mttr').textContent = metricas.mttr_segundos != null ? fmtDuracao(metricas.mttr_segundos) : '--';
    $('m-paradas').textContent = metricas.total_resolvidas;

    calcularAlertas(ocorrencias);
    render();

    $('tabela-historico').innerHTML = ocorrencias.length
      ? ocorrencias
          .map(
            (o) => `
        <tr>
          <td class="py-2 pr-3 text-slate-400">#${o.id}</td>
          <td class="pr-3">${esc(o.sensor_nome)}</td>
          <td class="pr-3">${fmtData(o.inicio_em)}</td>
          <td class="pr-3">${fmtData(o.fim_em)}</td>
          <td class="pr-3">${esc(o.tecnico_nome) || '--'}</td>
          <td class="pr-3 font-mono">${fmtDuracao(o.duracao_segundos)}</td>
          <td class="pr-3"><span class="px-2 py-0.5 rounded text-xs font-semibold ${
            o.status === 'ATIVA' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
          }">${o.status}</span></td>
          <td>${
            o.status === 'RESOLVIDO'
              ? `<button data-arquivar="${o.id}" class="text-xs text-slate-400 hover:text-red-400">Arquivar</button>`
              : ''
          }</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="8" class="py-6 text-center text-slate-500">Nenhuma ocorrência registrada.</td></tr>';
  }

  // ---------- CSV ----------
  function exportarCSV() {
    if (!cache.length) return toast('Não há ocorrências para exportar.', 'erro');
    const cab = ['ID', 'Sensor', 'Início', 'Fim', 'Técnico', 'Matrícula', 'Duração (s)', 'Status', 'NR-12'];
    const linhas = cache.map((o) =>
      [o.id, o.sensor_nome, o.inicio_em, o.fim_em || '', o.tecnico_nome || '', o.tecnico_matricula || '',
       o.duracao_segundos ?? '', o.status, o.nr12_aceite ? 'SIM' : 'NÃO']
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';')
    );
    const blob = new Blob(['\uFEFF' + [cab.join(';'), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saferecovery-ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Eventos ----------
  document.addEventListener('estado_linha', (ev) => { estado = ev.detail; render(); });

  document.addEventListener('alerta_falha', (ev) => {
    inicioFalha = Date.parse(ev.detail.ocorrencia.inicio_em);
    $('timer-parada').textContent = fmtDuracao((Date.now() - inicioFalha) / 1000);
  });

  document.addEventListener('linha_liberada', (ev) => {
    inicioFalha = null;
    const o = ev.detail.ocorrencia;
    toast(`Linha liberada por ${o.tecnico_nome} (parada de ${fmtDuracao(o.duracao_segundos)}).`);
  });

  document.addEventListener('historico_atualizado', carregarHistorico);

  $('tabela-historico').addEventListener('click', async (ev) => {
    const id = ev.target.dataset.arquivar;
    if (!id || !confirm(`Arquivar a ocorrência #${id}? O registro continua no banco.`)) return;
    await fetch(`/api/ocorrencias/${id}`, { method: 'DELETE' });
  });

  $('btn-csv').addEventListener('click', exportarCSV);

  $('btn-simular').addEventListener('click', async () => {
    const sensor = ['S01', 'S02', 'S03'][Math.floor(Math.random() * 3)];
    const r = await fetch('/api/ocorrencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensor_id: sensor }),
    });
    if (r.status === 409) toast('A linha já está em Modo de Descanso.', 'erro');
  });

  // 3) ---------- Acionamento manual do Botão de Resgate ----------
  $('btn-manual').addEventListener('click', async () => {
    if (estado && estado.status === 'MODO_DESCANSO') {
      return toast('A linha já está em Modo de Descanso.', 'erro');
    }
    const ok = confirm(
      'Acionar o Botão de Resgate manualmente?\n\nA esteira será parada e o braço robótico irá para a posição de descanso.'
    );
    if (!ok) return;
    const r = await fetch('/api/ocorrencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensor_id: 'MANUAL' }),
    });
    if (r.status === 409) toast('A linha já está em Modo de Descanso.', 'erro');
  });

  // 3) ---------- Indicador de conexão ao vivo ----------
  document.addEventListener('conexao', (ev) => {
    const on = ev.detail;
    $('live-dot').className = `h-2 w-2 rounded-full ${on ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`;
    $('live-txt').textContent = on ? 'AO VIVO' : 'SEM CONEXÃO';
  });

  // ---------- Carga inicial ----------
  fetch('/api/status').then((r) => r.json()).then((e) => { estado = e; render(); });
  carregarHistorico();
})();
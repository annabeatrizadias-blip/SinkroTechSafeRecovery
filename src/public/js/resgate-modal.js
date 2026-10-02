(() => {
  const { $: el, esc, fmtDuracao, fmtData, toast } = window.Util;

  let ocorrenciaAtual = null;

  function validar() {
    el('btn-resgate').disabled = !(
      el('chk-nr12').checked &&
      el('tec-nome').value.trim() &&
      el('tec-matricula').value.trim()
    );
  }

  function abrirModal({ ocorrencia, sensor, historico_sensor }) {
    ocorrenciaAtual = ocorrencia;

    el('r-sensor').textContent = sensor.nome;
    el('r-local').textContent = sensor.local || '';
    el('r-leitura').textContent =
      ocorrencia.valor_lido != null
        ? `Leitura: ${ocorrencia.valor_lido} ${sensor.unidade || ''} (limite seguro: ${ocorrencia.limite} ${sensor.unidade || ''})`
        : '';

    el('r-causas').innerHTML = (sensor.causas || []).map((c) => `<li>${esc(c)}</li>`).join('');

    el('r-historico-sensor').innerHTML = historico_sensor.length
      ? historico_sensor
          .map(
            (h) => `<tr class="border-b">
              <td class="py-1">#${h.id}</td>
              <td>${fmtData(h.inicio_em)}</td>
              <td>${fmtDuracao(h.duracao_segundos)}</td>
              <td>${esc(h.tecnico_nome) || '--'}</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="4" class="py-2 text-slate-400">Sem falhas anteriores neste sensor.</td></tr>';

    el('chk-nr12').checked = false;
    el('tec-nome').value = '';
    el('tec-matricula').value = '';
    el('r-erro').classList.add('hidden');
    validar();

    el('modal-resgate').classList.remove('hidden');
    el('tec-nome').focus();
  }

  function fecharModal() {
    el('modal-resgate').classList.add('hidden');
    ocorrenciaAtual = null;
  }

  async function acionarResgate() {
    if (!ocorrenciaAtual) return;
    el('btn-resgate').disabled = true;

    try {
      const r = await fetch(`/api/ocorrencias/${ocorrenciaAtual.id}/resgate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tecnico_nome: el('tec-nome').value.trim(),
          tecnico_matricula: el('tec-matricula').value.trim(),
          nr12_aceite: el('chk-nr12').checked,
        }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro || 'Erro ao liberar a linha.');
      // O modal fecha quando o evento 'linha_liberada' chega via Socket.io
    } catch (err) {
      el('r-erro').textContent = err.message;
      el('r-erro').classList.remove('hidden');
      toast(err.message, 'erro');
      validar();
    }
  }

  ['chk-nr12', 'tec-nome', 'tec-matricula'].forEach((id) => {
    el(id).addEventListener('input', validar);
    el(id).addEventListener('change', validar);
  });
  el('btn-resgate').addEventListener('click', acionarResgate);

  document.addEventListener('alerta_falha', (ev) => abrirModal(ev.detail));
  document.addEventListener('linha_liberada', fecharModal);
})();
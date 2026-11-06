/**
 * Atividades Kanban — avisos no WhatsApp (Google Apps Script)
 *
 * Lê a planilha oficial e envia ao SEU WhatsApp, pelo CallMeBot (gratuito, uso pessoal):
 *  1. Um resumo diário (compromissos, planejadas, atrasadas, etapas com prazo/lembrete e o dia seguinte).
 *  2. Avisos ao longo do dia: compromisso com horário que começa em breve e lembretes de etapas.
 *
 * Só LÊ a planilha. Telefone e chave ficam nas Propriedades do script, nunca neste código.
 * Passo a passo: whatsapp/LEIA-ME.md
 */

const WPP = {
  SHEET_ID: '1_JIumqQ4X3Oh_O3RLtNVHN6vD_7lPHP_a9SYMGh1DtA',
  TZ: 'America/Cuiaba',        // mesmo fuso usado pelo aplicativo
  HORA_RESUMO: 6,              // hora do resumo diário (0–23)
  ANTECEDENCIA_MIN: 60,        // aviso de compromisso: quantos minutos antes
  ENVIAR_RESUMO_VAZIO: true,   // false = não envia o resumo quando não há nada no dia
  AVISAR_ETAPAS: true,         // avisos de lembrete das etapas no horário escolhido no app
  MAX_ITENS: 12                // itens por seção no resumo
};

/* ======================= 1. CONFIGURAÇÃO (rodar uma vez) ======================= */

/** Preencha telefone e chave, execute UMA vez e depois apague os valores daqui. */
function wppConfigurar() {
  const telefone = '+55DDDNUMERO';   // ex.: +5565999999999 (com +55 e DDD)
  const apikey = 'SUA_CHAVE';        // chave enviada pelo CallMeBot
  if (telefone.indexOf('DDD') >= 0 || apikey === 'SUA_CHAVE') throw new Error('Preencha telefone e apikey antes de executar.');
  PropertiesService.getScriptProperties().setProperties({ WPP_PHONE: telefone.replace(/[^\d+]/g, ''), WPP_APIKEY: apikey.trim() });
  Logger.log('Configuração salva. Agora apague o telefone e a chave deste código e execute wppEnviarTeste.');
}

/** Envia o resumo de hoje agora, para conferir. */
function wppEnviarTeste() {
  const msg = wppMontarResumo_(new Date());
  wppEnviar_(msg || 'Atividades Kanban: teste de envio. Nada agendado para hoje.');
  Logger.log(msg);
}

/** Liga os envios automáticos (resumo diário + verificação a cada hora). */
function wppAtivar() {
  wppDesativar();
  ScriptApp.newTrigger('wppResumoDiario').timeBased().everyDays(1).atHour(WPP.HORA_RESUMO).nearMinute(0).inTimezone(WPP.TZ).create();
  ScriptApp.newTrigger('wppVerificarProximos').timeBased().everyMinutes(30).create();
  Logger.log('Ativado: resumo diário às ' + WPP.HORA_RESUMO + 'h e verificação a cada 30 minutos.');
}

/** Desliga todos os envios automáticos deste script. */
function wppDesativar() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['wppResumoDiario', 'wppVerificarProximos'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/* ======================= 2. EXECUÇÕES AUTOMÁTICAS ======================= */

function wppResumoDiario() {
  const msg = wppMontarResumo_(new Date());
  if (msg) wppEnviar_(msg);
}

/** Compromissos com horário que começam em breve e lembretes de etapas. Não repete o mesmo aviso. */
function wppVerificarProximos(e) {
  const agora = e instanceof Date ? e : new Date();   // o acionador passa um evento; testes passam uma data
  const hoje = wppIso_(agora);
  const minAgora = Number(Utilities.formatDate(agora, WPP.TZ, 'H')) * 60 + Number(Utilities.formatDate(agora, WPP.TZ, 'm'));
  const dados = wppLer_();
  const props = PropertiesService.getScriptProperties();
  const chave = 'WPP_ENVIADOS_' + hoje;
  const enviados = JSON.parse(props.getProperty(chave) || '[]');
  const avisos = [];

  dados.tarefas.forEach(t => {
    if (!wppAtiva_(t) || !t.agendaInicio || t.diaInteiro || !t.horaInicio) return;
    if (!(t.agendaInicio <= hoje && hoje <= (t.agendaFim || t.agendaInicio))) return;
    const ini = wppMin_(t.horaInicio);
    const falta = ini - minAgora;
    const id = 'c:' + t.id + ':' + hoje;
    if (falta >= 0 && falta <= WPP.ANTECEDENCIA_MIN + 15 && enviados.indexOf(id) < 0) {
      avisos.push('⏰ *Em ' + (falta <= 5 ? 'instantes' : falta + ' min') + '*: ' + t.horaInicio + (t.horaFim ? '–' + t.horaFim : '') + ' ' + t.titulo + (t.local ? '\n📍 ' + t.local : ''));
      enviados.push(id);
    }
  });

  if (WPP.AVISAR_ETAPAS) {
    dados.tarefas.forEach(t => {
      if (!wppAtiva_(t)) return;
      t.etapas.forEach(e => {
        if (e.concluida || !e.prazo || e.lembrete === '') return;
        const dataAviso = wppSomarDias_(e.prazo, -Number(e.lembrete));
        const id = 'e:' + e.id + ':' + dataAviso;
        if (dataAviso !== hoje || enviados.indexOf(id) >= 0) return;
        if (minAgora < wppMin_(e.hora || '08:00')) return;
        avisos.push('🔔 *Lembrete*: etapa "' + e.titulo + '" de ' + t.titulo + ' — prazo ' + wppBr_(e.prazo) + (e.prazo === hoje ? ' (hoje)' : ''));
        enviados.push(id);
      });
    });
  }

  if (avisos.length) {
    wppEnviar_(avisos.join('\n\n'));
    props.setProperty(chave, JSON.stringify(enviados));
  }
  wppLimparAntigos_(props, hoje);
}

/* ======================= 3. RESUMO ======================= */

function wppMontarResumo_(quando) {
  const hoje = wppIso_(quando), amanha = wppSomarDias_(hoje, 1);
  const dados = wppLer_();
  const ativas = dados.tarefas.filter(wppAtiva_);
  const noDia = (t, d) => t.agendaInicio && t.agendaInicio <= d && d <= (t.agendaFim || t.agendaInicio);
  const porHora = (a, b) => (a.diaInteiro ? '00:00' : a.horaInicio || '99').localeCompare(b.diaInteiro ? '00:00' : b.horaInicio || '99');
  const linhaCompromisso = t => '• ' + (t.diaInteiro || !t.horaInicio ? 'Dia inteiro' : t.horaInicio + (t.horaFim ? '–' + t.horaFim : '')) + ' ' + t.titulo + (t.local || t.fazenda ? ' — ' + (t.local || t.fazenda) : '');

  const compromissos = ativas.filter(t => noDia(t, hoje)).sort(porHora);
  const planejadas = ativas.filter(t => t.planejada === hoje && !noDia(t, hoje));
  const atrasadas = ativas.filter(t => t.prazo && t.prazo < hoje);
  const etapas = [];
  ativas.forEach(t => t.etapas.forEach(e => {
    if (e.concluida || !e.prazo) return;
    const aviso = e.lembrete !== '' ? wppSomarDias_(e.prazo, -Number(e.lembrete)) : '';
    const tipo = e.prazo < hoje ? 'atrasada' : e.prazo === hoje ? 'vence hoje' : (aviso && aviso <= hoje ? 'vence ' + wppBr_(e.prazo) : '');
    if (tipo) etapas.push({ ordem: e.prazo, texto: '• ' + e.titulo + ' (' + t.titulo + ') — ' + tipo });
  }));
  etapas.sort((a, b) => a.ordem.localeCompare(b.ordem));
  const amanhaComp = ativas.filter(t => noDia(t, amanha)).sort(porHora);

  const total = compromissos.length + planejadas.length + atrasadas.length + etapas.length;
  if (!total && !amanhaComp.length && !WPP.ENVIAR_RESUMO_VAZIO) return '';

  const dia = Utilities.formatDate(quando, WPP.TZ, 'dd/MM');
  const semana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][Number(Utilities.formatDate(quando, WPP.TZ, 'u')) % 7];
  const partes = ['*Kanban — ' + semana + ', ' + dia + '*'];
  const secao = (titulo, itens, fmt) => {
    if (!itens.length) return;
    const lista = itens.slice(0, WPP.MAX_ITENS).map(fmt);
    if (itens.length > WPP.MAX_ITENS) lista.push('… e mais ' + (itens.length - WPP.MAX_ITENS));
    partes.push(titulo + ' (' + itens.length + ')\n' + lista.join('\n'));
  };
  secao('📍 *Compromissos hoje*', compromissos, linhaCompromisso);
  secao('☀️ *Planejadas para hoje*', planejadas, t => '• ' + t.titulo + (t.fazenda ? ' — ' + t.fazenda : ''));
  secao('⚠️ *Atrasadas*', atrasadas.sort((a, b) => a.prazo.localeCompare(b.prazo)), t => '• ' + t.titulo + ' — prazo ' + wppBr_(t.prazo));
  secao('🧩 *Etapas*', etapas, e => e.texto);
  if (!total) partes.push('Nada agendado para hoje.');
  secao('📅 *Amanhã*', amanhaComp, linhaCompromisso);
  return partes.join('\n\n');
}

/* ======================= 4. LEITURA DA PLANILHA ======================= */

function wppLer_() {
  const ss = SpreadsheetApp.openById(WPP.SHEET_ID);
  const tabela = nome => {
    const aba = ss.getSheetByName(nome);
    if (!aba) return [];
    const v = aba.getDataRange().getValues();
    const h = (v[0] || []).map(String);
    return v.slice(1).map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i]; }); return o; });
  };
  const sim = x => String(x || '').trim().toLowerCase() === 'sim';
  const txt = x => String(x == null ? '' : x).trim();
  const etapasPor = {};
  tabela('Subtarefas').forEach(s => {
    if (!txt(s.Subtask_ID) || !txt(s.Task_ID) || sim(s.Arquivada)) return;
    (etapasPor[txt(s.Task_ID)] = etapasPor[txt(s.Task_ID)] || []).push({
      id: txt(s.Subtask_ID), titulo: txt(s.Titulo) || 'Etapa', prazo: wppData_(s.Prazo),
      concluida: txt(s.Status) === 'Concluído', lembrete: txt(s.Lembrete_dias), hora: wppHora_(s.Lembrete_hora)
    });
  });
  const tarefas = tabela('Tarefas').filter(t => txt(t.ID)).map(t => ({
    id: txt(t.ID), titulo: txt(t.Titulo) || '(sem título)', status: txt(t.Status), fazenda: txt(t.Fazenda),
    excluida: sim(t.Excluido), arquivada: sim(t.Arquivado), modelo: sim(t.Modelo),
    prazo: wppData_(t.Prazo), planejada: wppData_(t.Data_planejada),
    agendaInicio: wppData_(t.Agenda_inicio), agendaFim: wppData_(t.Agenda_fim), diaInteiro: sim(t.Agenda_dia_inteiro),
    horaInicio: wppHora_(t.Agenda_hora_inicio), horaFim: wppHora_(t.Agenda_hora_fim), local: txt(t.Agenda_local),
    etapas: etapasPor[txt(t.ID)] || []
  }));
  return { tarefas };
}

/* ======================= 5. ENVIO ======================= */

function wppEnviar_(texto) {
  const p = PropertiesService.getScriptProperties();
  const phone = p.getProperty('WPP_PHONE'), apikey = p.getProperty('WPP_APIKEY');
  if (!phone || !apikey) throw new Error('Execute wppConfigurar primeiro.');
  // URLs muito longas falham; o resumo é limitado a ~1.500 caracteres.
  const msg = texto.length > 1500 ? texto.slice(0, 1480) + '\n…' : texto;
  const url = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(phone) + '&text=' + encodeURIComponent(msg) + '&apikey=' + encodeURIComponent(apikey);
  let ultimo = '';
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    ultimo = r.getResponseCode() + ' ' + r.getContentText().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200);
    if (r.getResponseCode() === 200 && !/error|invalid|apikey/i.test(r.getContentText().slice(0, 400))) return true;
    Utilities.sleep(4000 * (tentativa + 1));
  }
  throw new Error('CallMeBot não confirmou o envio: ' + ultimo);
}

/* ======================= 6. UTILITÁRIOS ======================= */

function wppAtiva_(t) { return !t.excluida && !t.arquivada && !t.modelo && t.status !== 'Concluído' && t.status !== 'Cancelado'; }
function wppIso_(d) { return Utilities.formatDate(d, WPP.TZ, 'yyyy-MM-dd'); }
function wppBr_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function wppMin_(h) { const m = String(h || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; }
function wppSomarDias_(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/** Aceita data como texto (dd/mm/aaaa ou aaaa-mm-dd) ou como data da planilha. */
function wppData_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, WPP.TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return m[3] + '-' + m[2] + '-' + m[1];
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  return '';
}
/** Aceita hora como texto (08:00) ou como hora da planilha. */
function wppHora_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, WPP.TZ, 'HH:mm');
  const m = String(v || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function wppLimparAntigos_(props, hoje) {
  Object.keys(props.getProperties()).forEach(k => {
    if (k.indexOf('WPP_ENVIADOS_') === 0 && k.slice(13) < wppSomarDias_(hoje, -3)) props.deleteProperty(k);
  });
}

# Avisos do Atividades Kanban no WhatsApp

Um script do Google Apps Script lê a planilha oficial e manda mensagens para o **seu** WhatsApp pelo CallMeBot (gratuito para uso pessoal). Ele roda na nuvem do Google: funciona com o app e o computador desligados.

## O que você recebe

- **Resumo diário** (padrão: 6h): compromissos de hoje, planejadas para hoje, atrasadas, etapas atrasadas ou vencendo, lembretes de etapas e os compromissos de amanhã.
- **Aviso antes de compromissos com horário** (padrão: cerca de 1 hora antes).
- **Lembretes de etapas**, no dia e horário escolhidos no app.

O script só **lê** a planilha. Nada é alterado.

## Configuração (uma vez, ~10 minutos)

### 1. Ativar o CallMeBot no seu WhatsApp
1. Salve o número **+34 621 371 153** nos contatos do celular, com qualquer nome.
2. Envie para ele, pelo WhatsApp, a mensagem: `I allow callmebot to send me messages`
3. Você recebe uma resposta com **APIKEY**. Guarde o número da chave.
   Se a resposta não chegar em 2 minutos, tente de novo depois de 24 horas.

### 2. Criar o script
1. Abra [script.google.com](https://script.google.com) com a mesma conta Google da planilha e clique em **Novo projeto**.
2. Dê o nome **Kanban WhatsApp**.
3. Apague o conteúdo do arquivo `Código.gs` e cole todo o conteúdo de `Codigo.gs`. Salve.
4. Em **Configurações do projeto** (engrenagem), ajuste o **Fuso horário** para **(GMT-04:00) Cuiabá**, o mesmo usado pelo app.

### 3. Configurar telefone e chave
1. Na função `wppConfigurar`, troque `+55DDDNUMERO` pelo seu número (ex.: `+5565999999999`) e `SUA_CHAVE` pela APIKEY.
2. No topo do editor, escolha **wppConfigurar** e clique em **Executar**.
3. O Google pede autorização: clique em **Revisar permissões**, escolha sua conta. Se aparecer "O Google não verificou este app", clique em **Avançado** → **Acessar Kanban WhatsApp**. As permissões são: ver suas planilhas, conectar a um serviço externo e executar quando você não estiver presente.
4. Depois de executar, **apague o telefone e a chave do código** (volte para `+55DDDNUMERO` e `SUA_CHAVE`) e salve. Eles ficam guardados nas Propriedades do script, fora do código.

### 4. Testar e ligar
1. Execute **wppEnviarTeste**. O resumo de hoje deve chegar no seu WhatsApp em alguns segundos.
2. Execute **wppAtivar**. A partir daí, os envios são automáticos.

## Ajustes

No início do código, em `WPP`:

| Opção | Padrão | O que faz |
| --- | --- | --- |
| `HORA_RESUMO` | `6` | Hora do resumo diário |
| `ANTECEDENCIA_MIN` | `60` | Minutos de antecedência do aviso de compromisso |
| `ENVIAR_RESUMO_VAZIO` | `true` | `false` = não envia o resumo quando não há nada no dia |
| `AVISAR_ETAPAS` | `true` | Avisos dos lembretes de etapas |
| `MAX_ITENS` | `12` | Itens por seção do resumo |

Depois de mudar `HORA_RESUMO`, execute **wppAtivar** de novo.

## Desligar

Execute **wppDesativar**.

## Bom saber

- O CallMeBot é um serviço de terceiros, gratuito só para uso pessoal e sem garantia de funcionamento. O texto das mensagens passa pelo servidor dele.
- Se um envio falhar, o erro aparece em **Execuções** no Apps Script, e o Google costuma avisar por e-mail.
- Os avisos ao longo do dia são verificados a cada 30 minutos, então podem chegar com alguns minutos de diferença.
- Os limites gratuitos do Apps Script são bem maiores do que o uso deste script.

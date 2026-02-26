import "dotenv/config";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { classifyMessagePrompt } from "./prompts/classify-message-prompt.js";
import {
  classifyMessageModelSchema,
  ClassifyMessageModelSchemaType,
} from "./schemas/classify-message-model.js";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-5-mini", // Certifique-se de que este modelo existe na sua assinatura
});

const structuredModelOutput = model.withStructuredOutput(
  classifyMessageModelSchema,
);
const prompt = ChatPromptTemplate.fromTemplate(classifyMessagePrompt);
const llmChain = prompt.pipe(structuredModelOutput);

// === ETAPA 3: REGRAS DE PRIORIDADE E ROBUSTEZ ===
// Função principal que orquestra tudo, recebendo as regras antes e depois do LLM.
async function classifyMessage(
  rawMessage: string,
): Promise<ClassifyMessageModelSchemaType> {
  // 1. Limpeza básica da entrada (antigo preProcess)
  const message = rawMessage
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .slice(0, 500)
    .trim();

  // ----------------------------------------------------------------
  // 3.1 Hard rules de OPT_OUT (Não depende do LLM)
  // ----------------------------------------------------------------

  // Usamos um pattern Regex para buscar exatamente essas palavras de forma case-insensitive (\b garante que é a palavra inteira)
  const optOutPattern =
    /\b(sair|cancelar|cancela|parar|pare|remover|descadastrar|desinscrever|stop)\b/i;
  const match = message.match(optOutPattern);

  if (match) {
    // Se encontrou o gatilho, nós retornamos imediatamente! (Bypass do LLM para economizar API e garantir a regra)
    const triggerWord = match[0].toLowerCase();

    // Normalização extra forçada usando o seu Map anterior (opcional, já que regex pega direto)
    const mapToStandard = {
      cancela: "cancelar",
      pare: "parar",
      stop: "parar",
      descadastrar: "remover",
      desinscrever: "remover",
    };
    const valueIntent =
      mapToStandard[triggerWord as keyof typeof mapToStandard] || triggerWord;

    return {
      intent: "OPT_OUT",
      confidence: 1.0, // Alta confiança (hard rule)
      entities: [{ type: "action", value: valueIntent }],
      should_reply: false, // Regra solicitada
      reply_hint: "", // Regra solicitada
    };
  }

  // ----------------------------------------------------------------
  // Restante das Custom Rules pré-LLM (Greetings, Risadas, etc)
  // ----------------------------------------------------------------

  // ----------------------------------------------------------------
  // 3.3 Restante das Custom Rules pré-LLM (Suporte, Feedback, etc)
  // ----------------------------------------------------------------

  // Suporte Técnico / Erros (Prioridade sobre feedback negativo genérico)
  const supportPattern =
    /\b(erro|falha|bug|não funciona|não está funcionando|tá dando erro|erro 500|500|404)\b/i;
  const supportMatch = message.match(supportPattern);

  if (supportMatch) {
    return {
      intent: "SUPPORT_REQUEST",
      confidence: 0.85,
      entities: [
        { type: "error_signal", value: 'erro' },
      ],
      should_reply: true,
      reply_hint: "Pedir desculpas e solicitar mais detalhes sobre o erro.",
    };
  }

  // Feedback Negativo Genérico (Cai aqui se tem xingamento/reclamação mas não tem termo de erro técnico)
  const negativePattern = /\b(ruim|péssimo|horrível|não gostei)\b/i;
  const negativeMatch = message.match(negativePattern);

  if (negativeMatch) {
    return {
      intent: "NEGATIVE_FEEDBACK",
      confidence: 0.8,
      entities: [],
      should_reply: true,
      reply_hint:
        "Pedir desculpas pela má experiência e perguntar como podemos melhorar.",
    };
  }

  // Saudações puras
  const optOutPatternsGretting = /^(oi|ola|olá|bom dia|boa tarde|boa noite)$/i;
  const matchGretting = message.match(optOutPatternsGretting);
  if (matchGretting) {
    return {
      intent: "GREETING",
      confidence: 0.75,
      entities: [],
      should_reply: true,
      reply_hint: "Perguntar como posso ajudar.",
    };
  }

  // Ruídos muito curtos ou risadas
  const isNoiseWord = /^(ok|hm|blz|valeu)$/i.test(message);
  const isLaughter = /^(k+|ha(ha)+|he(he)+|rs(rs)+)$/i.test(message);

  if (message.length <= 3 || isNoiseWord || isLaughter) {
    return {
      intent: "OTHER",
      confidence: 0.65, // Confiança moderada conforme especificado
      entities: [],
      should_reply: true, // Se devemos ou não responder no caso "OTHER"
      reply_hint: "Perguntar como posso ajudar.", // Dica padrão para engajar na conversa
    };
  }

  // ----------------------------------------------------------------
  // Execução do LLM (Apenas se nenhuma regra Hard cair)
  // ----------------------------------------------------------------
  let response = await llmChain.invoke({ message });

  // ----------------------------------------------------------------
  // Post-processamento (Ajustes finos no retorno do LLM)
  // ----------------------------------------------------------------
  if (response.intent === "INFO_REQUEST") {
    response.reply_hint = "";
  }

  // Garantia redundante: Se o LLM deduziu sozinho que é OPT_OUT, garantimos as flags.
  if (response.intent === "OPT_OUT") {
    response.should_reply = false;
    response.reply_hint = "";
  }

  return response;
}

// === TESTE ===
// Substituí o loop por uma chamada assíncrona usando a nova função de orquestração
async function runTests() {
  const messages = [
    "Quero sair dessa lista!", // Testando Regex \b e opt-out
    "cancela pfv", // Testando variações de opt-out
    "haha", // Testando hard rule de OTHER
    "bom dia", // Testando hard rule GREETING
    "ok", // Testando ruido curto (OTHER)
    "Isso é um absurdo, está dando erro no meu painel!", // Testando support (pega 'erro')
    "Não funciona de jeito nenhum", // Testando support
    "O serviço de vocês é péssimo", // Testando negative feedback
    "Eu não gostei do atendimento", // Testando negative feedback
    "O sistema é horrível, tá dando erro", // Testando prevalência do support sobre o negative
    "Qual o valor do serviço?", // Cai no LLM real
  ];

  for (const msg of messages) {
    const response = await classifyMessage(msg);
    console.log(`\n[Input]: "${msg}"`);
    console.log(JSON.stringify(response, null, 2));
  }
}

runTests();

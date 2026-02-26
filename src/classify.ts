import "dotenv/config";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda } from "@langchain/core/runnables";
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

// === ETAPA 3: REGRAS DE PRIORIDADE E ROBUSTEZ (LangChain Native) ===

// 1. Limpeza básica da entrada
const preProcess = new RunnableLambda({
  func: (input: { message: string }) => {
    const cleanedMessage = input.message
      .replace(/\r\n/g, "\n")
      .replace(/\n+/g, "\n")
      .replace(/[ \t]+/g, " ")
      .slice(0, 500)
      .trim();

    return { message: cleanedMessage };
  },
});

// 2. Roteador de Políticas Pré-LLM (Avalia Regras e faz Curto-Circuito)
const policyPreLLM = new RunnableLambda({
  func: async (input: {
    message: string;
  }): Promise<ClassifyMessageModelSchemaType> => {
    const msg = input.message;

    // 3.1 Hard rules de OPT_OUT
    const optOutPattern =
      /\b(sair|cancelar|cancela|parar|pare|remover|descadastrar|desinscrever|stop)\b/i;
    const optOutMatch = msg.match(optOutPattern);
    if (optOutMatch) {
      const triggerWord = optOutMatch[0].toLowerCase();
      const mapToStandard = {
        cancela: "cancelar",
        pare: "parar",
        stop: "parar",
        sair: "parar",
        descadastrar: "remover",
        desinscrever: "remover",
      };
      const valueIntent =
        mapToStandard[triggerWord as keyof typeof mapToStandard] || triggerWord;

      return {
        intent: "OPT_OUT",
        confidence: 1.0,
        entities: [{ type: "action", value: valueIntent }],
        should_reply: false,
        reply_hint: "",
      };
    }

    // 3.2 Suporte Técnico / Erros
    const supportPattern =
      /\b(erro|falha|bug|não funciona|não está funcionando|tá dando erro|erro 500|500|404)\b/i;
    const supportMatch = msg.match(supportPattern);

    if (supportMatch) {
      return {
        intent: "SUPPORT_REQUEST",
        confidence: 0.85,
        entities: [{ type: "error_signal", value: supportMatch[0] }],
        should_reply: true,
        reply_hint: "Pedir desculpas e solicitar mais detalhes sobre o erro.",
      };
    }

    // 3.3 Feedback Negativo Genérico
    const negativePattern = /\b(ruim|péssimo|horrível|não gostei)\b/i;
    if (msg.match(negativePattern)) {
      return {
        intent: "NEGATIVE_FEEDBACK",
        confidence: 0.8,
        entities: [],
        should_reply: true,
        reply_hint:
          "Pedir desculpas pela má experiência e perguntar como podemos melhorar.",
      };
    }

    // 3.4 Saudações puras
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite)$/i.test(msg)) {
      return {
        intent: "GREETING",
        confidence: 0.75,
        entities: [],
        should_reply: true,
        reply_hint: "Cumprimentar e perguntar como posso ajudar.",
      };
    }

    // 3.5 Ruídos muito curtos ou risadas
    const isNoiseWord = /^(ok|hm|blz|valeu)$/i.test(msg);
    const isLaughter = /^(k+|ha(ha)+|he(he)+|rs(rs)+)$/i.test(msg);
    if (msg.length <= 3 || isNoiseWord || isLaughter) {
      return {
        intent: "OTHER",
        confidence: 0.65,
        entities: [],
        should_reply: true,
        reply_hint: "Perguntar como posso ajudar.",
      };
    }

    // Se nenhuma Hard Rule passou, chamamos o LLM internamente!
    return await llmChain.invoke({ message: msg });
  },
});

// 3. Roteador de Políticas Pós-LLM (Ajustes finais)
const policyPostLLM = new RunnableLambda({
  func: (response: ClassifyMessageModelSchemaType) => {
    if (response.intent === "INFO_REQUEST") {
      response.reply_hint = "";
    }

    if (response.intent === "OPT_OUT") {
      response.should_reply = false;
      response.reply_hint = "";
    }

    return response;
  },
});

// === A CHAIN FINAL ORQUESTRADA ===
// Fluxo: Limpeza -> Políticas Pré/LLM Wrapper -> Políticas Pós
const classifyMessageChain = preProcess.pipe(policyPreLLM).pipe(policyPostLLM);

// === TESTES ===
async function runTests() {
  const messages = [
    "Quero sair dessa lista!", // Testando Regex \b e opt-out
    "cancela pfv", // Testando variações de opt-out
    "haha", // Testando hard rule de OTHER
    "bom dia", // Testando hard rule GREETING
    "bom domingo",
    "ok", // Testando ruido curto (OTHER)
    "Isso é um absurdo, está dando erro no meu painel!", // Testando support (pega 'erro')
    "Não funciona de jeito nenhum", // Testando support
    "O serviço de vocês é péssimo", // Testando negative feedback
    "O sistema é horrível, tá dando erro", // Testando prevalência do support sobre o negative
    "Qual o valor do serviço?", // Cai no LLM real
  ];

  for (const msg of messages) {
    const response = await classifyMessageChain.invoke({ message: msg });
    console.log(`\n[Input]: "${msg}"`);
    console.log(JSON.stringify(response, null, 2));
  }
}

runTests();

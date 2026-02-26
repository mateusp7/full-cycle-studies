import z from "zod";

export const classifyMessageModelSchema = z.object({
  intent: z.enum([
    "OPT_OUT",
    "GREETING",
    "INFO_REQUEST",
    "SUPPORT_REQUEST",
    "BILLING",
    "SCHEDULING",
    "NEGATIVE_FEEDBACK",
    "SPAM",
    "OTHER",
  ]),
  confidence: z.number().min(0).max(1),
  entities: z.array(z.object({
    type: z.enum(["action", "product_or_plan", "payment_method", "date", "time", "order_id", "error_signal"]),
    value: z.string()
  })).describe(`
    Idioma fixo é PT-BR

    1. action:
      - quando houver uma ação explícita: “cancelar”, “sair”, “parar”, “remover”
      - ex: { "type": "action", "value": "cancelar" }
      - ex: { "type": "action", "value": "sair" }
      - ex: { "type": "action", "value": "parar" }
      - ex: { "type": "action", "value": "remover" }
    2. product_or_plan:
      - quando mencionar plano/assinatura/produto: “plano premium”, “mensal”, “pro”
      - ex: { "type": "product_or_plan", "value": "plano premium" }
    3. payment_method
      - quando citar “pix”, “boleto”, “cartão”
      - ex: { "type": "payment_method", "value": "pix" }
    4. date
      - “amanhã”, “hoje”, “25/02”, “sexta”
      - ex: { "type": "date", "value": "amanhã" }
    5. time
      - “14h”, “18:30”
      - ex: { "type": "time", "value": "14h" }
    6. order_id
      - qualquer identificador: “pedido 1234”, “#A98F”
      - ex: { "type": "order_id", "value": "1234" }
    7. error_signal
      - quando houver sinal de erro: “erro 500”, “falha”, “não funciona”, “bug”
      - ex: { "type": "error_signal", "value": "não está funcionando" }
  `),
  should_reply: z.boolean().describe("Se intent = OPT_OUT, então deve ser false. Caso contrário, deve ser true"),
  reply_hint: z.string().max(160).describe("Se intent = OPT_OUT, então deve ser vazio. Caso contrário, deve ser uma dica de resposta")
});

export type ClassifyMessageModelSchemaType = z.infer<typeof classifyMessageModelSchema>
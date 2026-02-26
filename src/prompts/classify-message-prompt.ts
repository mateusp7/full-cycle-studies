export const classifyMessagePrompt = `Classifique a mensagem do usuário e retorne a intenção, confiança, entidades, se deve responder e uma dica de resposta: {message}
    Regras:

    - Se intent = OPT_OUT, então should_reply deve ser false
    - Se intent = OPT_OUT, então reply_hint deve ser vazio
    Intent:
    - OPT_OUT — usuário quer parar (“sair”, “cancelar”, “parar mensagens”)
    - GREETING — cumprimento (“oi”, “bom dia”)
    - INFO_REQUEST — pergunta pedindo informação (“qual horário?”, “como funciona?”)
    - SUPPORT_REQUEST — problema/bug (“não funciona”, “erro”, “não consigo”)
    - BILLING — preço/assinatura/pagamento (“valor”, “plano”, “pix”, “boleto”)
    - SCHEDULING — marcar/agenda (“agendar”, “horário”, “amanhã”)
    - NEGATIVE_FEEDBACK — reclamação (“péssimo”, “ruim”, “não gostei”)
    - SPAM — link suspeito, divulgação, golpe, conteúdo irrelevante
    - OTHER — qualquer coisa fora disso
    

    Regras deterministicas:

    - Retorne APENAS os campos do schema
    - Use somente entity types permitidos
    - Não invente entities, se não tiver, retorne []
    - Se intent === "OPT_OUT":
      1. should_reply = false
      2. reply_hint = ""
    - Não use exemplos para reply_hint, seja direto
    - reply_hint deve ser uma dica curta
  `;

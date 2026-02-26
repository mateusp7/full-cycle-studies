# About project

This project is a message classifier for WhatsApp or any chat, that don't answer the user, just verify the message and create the way to answer. I created this project to study the LangChain library and its features.

## Flow

- Recieve message
- Call the model to classify the message
- The classifier will return the intent, confidence, entities, if should reply and a hint to reply
- The API decide if will answer, disabled automations or forward to support

## Field of classifier

- Intent:
  1. `OPT_OUT` — user wants to stop (“sair”, “cancelar”, “parar mensagens”)
  2. `GREETING` — greeting (“oi”, “bom dia”)
  3. `INFO_REQUEST` — asking for information (“qual horário?”, “como funciona?”)
  4. `SUPPORT_REQUEST` — problem/bug (“não funciona”, “erro”, “não consigo”)
  5. `BILLING` — price/subscription/payment (“valor”, “plano”, “pix”, “boleto”)
  6. `SCHEDULING` — schedule/agenda (“agendar”, “horário”, “amanhã”)
  7. `NEGATIVE_FEEDBACK` — complaint (“péssimo”, “ruim”, “não gostei”)
  8. `SPAM` — suspicious link, promotion, scam, irrelevant content
  9. `OTHER` — anything else
- Confidence: 0 to 1
  - If the confidence is less than 0.55, the intent will be OTHER and the classifier will sugest to request explanation
- Entities: 
  1. type: 
    - action
    - date
    - time
    - location
    - product
    - service
    - price
    - payment_method
    - feedback
    - spam
    - other
  2. value: string
- Should reply: boolean
  - If intent is `OPT_OUT`, `should_reply` will be false
- Reply hint: string
  - If intent is `OPT_OUT`, `reply_hint` will be empty
  - Max length is 160 characters

## Tech Stack

- Node.js
- TypeScript
- LangChain
- OpenAI
- Zod

## Installation

```bash
pnpm install
```

## Usage

```bash
pnpm run dev
```
<div align="center">
  <img src="1.cortexAI/frontend/src/assets/hero.png" width="110" alt="CortexAI" />

  <h1>CortexAI</h1>

  <p><strong>One workspace. Many AI agents.</strong></p>

  <p>
    Chat, search the web, generate code, documents, presentations, and images —
    with PDF and image understanding built in.
  </p>

  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/LangGraph-agents-1C3C3C" alt="LangGraph" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Redis-sessions%20%26%20limits-DC382D?logo=redis&logoColor=white" alt="Redis" />
</div>

---

## Overview

CortexAI is a full-stack, multi-agent AI workspace. A React client talks to an
Express gateway that fans requests out to four backend services: **auth**,
**chat**, **agent**, and **billing**.

The agent service uses **LangGraph** to route each request to a specialist:
general chat, live web search, coding, PDF generation, presentation generation,
image generation, PDF RAG, or image analysis. Every response is persisted to the
conversation, and usage is metered through a credit system backed by Razorpay.

> The application code lives in the [`1.cortexAI/`](1.cortexAI/) directory of this
> repository. Unless noted, commands below start from that application directory
> (the inner folder containing `backend/` and `frontend/`).

## Features

- **Multi-agent chat** — automatic routing plus manual agent selection from the
  composer (`Auto`, `Chat`, `Search`, `Coding`, `PDF`, `PPT`, `Vision`).
- **Conversation memory** — recent messages are cached in Redis and replayed to
  the model for context-aware answers.
- **Live web search** — Tavily results are fetched first, then summarized by the
  chat agent with source context and images.
- **Coding workspace** — generate complete HTML/CSS/JS projects, inspect files in
  a Monaco editor, and run a sandboxed live preview. Also handles review,
  debugging, explanation, optimization, conversion, and documentation requests.
- **Document generation** — AI-written PDF reports (PDFKit) and PowerPoint decks
  (PptxGenJS) with cover, content, and closing slides.
- **PDF RAG** — upload a PDF, split it into chunks, embed it with Gemini, store it
  in Qdrant, and answer questions from the document only.
- **Vision** — analyze uploaded images (including text, charts, and tables), or
  generate new images from an engineered prompt.
- **Google sign-in** — Firebase Authentication on the client, verified with the
  Firebase Admin SDK on the server; sessions live in Redis.
- **Credits and billing** — per-agent credit costs, plan upgrades, and Razorpay
  payment verification.
- **Built-in guardrails** — per-minute, per-user rate limits for every agent.
- **Polished UX** — responsive dark interface, animated loading states,
  Markdown rendering, syntax highlighting, attachments, and browser speech-to-text.

## Tech stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Redux Toolkit, Monaco Editor, Motion, React Markdown, Lucide |
| API gateway | Node.js, Express 5, `express-http-proxy`, `cookie-parser`, `morgan` |
| Agent orchestration | LangGraph, LangChain, Groq, Google Gemini, OpenRouter, Tavily |
| Data | MongoDB (Mongoose), Redis (ioredis), Qdrant (vector search) |
| Storage | Supabase Storage with signed URLs |
| Auth | Firebase Authentication (Google) + Firebase Admin SDK |
| Payments | Razorpay (orders + HMAC signature verification) |
| Infrastructure | Docker, AWS ECR, AWS ECS, AWS S3, CloudFront, GitHub Actions |

## Architecture

```text
React + Vite client
        │  HTTP + session cookie
        ▼
Gateway :8000
        ├── Auth :8001 ────── Firebase · MongoDB · Redis
        ├── Chat :8002 ────── MongoDB
        ├── Agent :8003 ───── LangGraph · LLMs · Tavily · Qdrant · Supabase
        └── Billing :8004 ─── Razorpay · MongoDB

Agent workflow:
router ──► chat / search / coding / pdf / ppt / vision
       └──► pdfRag / imageAnalyzer
```

External providers: **Groq**, **Google Gemini**, **OpenRouter**, **Tavily**,
**Qdrant**, **Supabase Storage**, **Firebase**, and **Razorpay**.

### Request lifecycle

1. The client signs in with Google and exchanges the Firebase ID token for an
   HTTP-only `session` cookie (`POST /api/auth/login`).
2. The gateway validates the cookie against Redis and forwards the user ID to
   downstream services as an `x-user-id` header.
3. The agent service saves the user message through the chat service, then invokes
   the LangGraph workflow.
4. The router either honors the selected agent, routes by file type (PDF → PDF
   RAG, image → image analysis), or asks an LLM to classify the prompt.
5. The chosen agent checks the per-minute limit, calls its model or tool, and
   deducts credits through the auth service.
6. The assistant message is persisted, and images/artifacts are returned to the
   client. Generated files are uploaded to Supabase and returned as signed URLs.

## Agents

| Agent | What it does | Model / provider | Credits | Limit / min |
| --- | --- | --- | ---: | ---: |
| `auto` (router) | Picks the best agent; PDFs and images are routed by MIME type | Groq `openai/gpt-oss-120b` | — | — |
| `chat` | General Q&A, explanations, Markdown answers; uses Redis history and search context | Groq `openai/gpt-oss-120b` | 1 | 20 |
| `search` | Live web search, then chat composes the answer from the results | Tavily + Groq | 6 | 5 |
| `coding` | Generates full projects or reviews/debugs/explains/optimizes code | OpenRouter `deepseek/deepseek-chat` | 10 | 5 |
| `pdf` | Writes structured content, renders a PDF with PDFKit, uploads it | Groq | 10 | 5 |
| `ppt` | Builds a presentation with a cover, content slides, and closing slide | Groq + PptxGenJS | 10 | 5 |
| `vision` | Engineers an image prompt and generates an image with Pollinations | Groq + Pollinations | 10 | 5 |
| `pdfRag` | Parses an uploaded PDF, embeds chunks, retrieves context from Qdrant, answers from the document only | Gemini embeddings + Groq | 10 | 5 |
| `imageAnalyzer` | Reads uploaded images and explains text, charts, and tables | Gemini `gemini-2.5-flash` | 10 | 5 |

`pdfRag` and `imageAnalyzer` are selected automatically when a PDF or image is
attached. They can also be requested explicitly by sending the agent name.

A search request runs the search agent first (5 credits), then the chat agent to
compose the final answer (1 credit), for **6 credits** total.

## Repository layout

```text
1.cortexAI/
├── backend/
│   ├── gateway/                  # Express API gateway, session guard, proxy
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── utils/
│   ├── services/
│   │   ├── auth/                 # Firebase login, Redis sessions, users, credits
│   │   ├── chat/                 # Conversations and messages
│   │   ├── agent/                # LangGraph workflow + specialist agents
│   │   │   ├── agents/
│   │   │   ├── config/
│   │   │   ├── graph/
│   │   │   └── utils/
│   │   └── billing/              # Razorpay orders and payment verification
│   ├── shared/redis/             # Shared ioredis client
│   └── docker-compose.yml        # Local Redis
├── frontend/
│   ├── src/components/           # Chat, sidebar, artifacts, billing drawer
│   ├── src/features/             # API helpers
│   ├── src/pages/                # Home / login experience
│   ├── src/redux/                # Redux Toolkit slices
│   └── utils/                    # Axios and Firebase setup
└── .github/workflows/deploy.yml  # ECR/ECS + S3/CloudFront deployment
```

## Getting started

### Prerequisites

- **Node.js 20+** (Node 22 LTS recommended) and npm
- **MongoDB** — local instance or MongoDB Atlas
- **Redis** — a local install or the included Docker Compose service
- **Docker** — optional, only needed for the bundled Redis container
- **Firebase project** — Google sign-in enabled, plus a Firebase Admin service
  account key
- **API keys** — Groq, Google AI Studio (Gemini), OpenRouter, and Tavily
- **Supabase project** — a storage bucket for generated files
- **Qdrant** — a cloud cluster or self-hosted instance
- **Razorpay account** — test or live keys (billing is INR-based)

### 1. Clone and install

```bash
git clone https://github.com/Priyanshukr766/1.cortexAI.git
cd 1.cortexAI/1.cortexAI    # application directory
```

From the application directory (the inner `1.cortexAI/` folder containing
`backend/` and `frontend/`), install the backend dependencies. The backend root
install is required because `shared/redis` resolves `ioredis` from
`backend/node_modules`.

```bash
cd backend
npm install

cd gateway && npm install
cd ../services/auth && npm install
cd ../chat && npm install
cd ../agent && npm install
cd ../billing && npm install
```

Open a new terminal at the application directory and install the frontend:

```bash
cd frontend
npm install
```

### 2. Configure environment files

Create a `.env` in each service directory. These files are gitignored, so use the
templates below.

<details>
<summary><strong>backend/gateway/.env</strong></summary>

```dotenv
PORT=8000
FRONTEND_URL=http://localhost:5173
AUTH_SERVICE=http://localhost:8001
CHAT_SERVICE=http://localhost:8002
AGENT_SERVICE=http://localhost:8003
BILLING_SERVICE=http://localhost:8004
REDIS_URL=redis://localhost:6379
```

</details>

<details>
<summary><strong>backend/services/auth/.env</strong></summary>

```dotenv
PORT=8001
MONGODB_URI=mongodb://localhost:27017/cortexai
REDIS_URL=redis://localhost:6379
```

Also place your Firebase Admin service account file at
`backend/services/auth/serviceAccountKey.json`. It is ignored by git and loaded by
`config/firebase.js`.

</details>

<details>
<summary><strong>backend/services/chat/.env</strong></summary>

```dotenv
PORT=8002
MONGODB_URI=mongodb://localhost:27017/cortexai
```

</details>

<details>
<summary><strong>backend/services/agent/.env</strong></summary>

```dotenv
PORT=8003
MONGODB_URI=mongodb://localhost:27017/cortexai
REDIS_URL=redis://localhost:6379
CHAT_SERVICE=http://localhost:8002
AUTH_SERVICE=http://localhost:8001

GROQ_API_KEY=your_groq_key
GOOGLE_API_KEY=your_google_ai_key
OPENROUTER_API_KEY=your_openrouter_key
TAVILY_API_KEY=your_tavily_key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
SUPABASE_BUCKET=cortexai

QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your_qdrant_key
```

If your Qdrant deployment requires authentication, pass `QDRANT_API_KEY` to the
client in `backend/services/agent/config/vectorDb.js` as well.

</details>

<details>
<summary><strong>backend/services/billing/.env</strong></summary>

```dotenv
PORT=8004
MONGODB_URI=mongodb://localhost:27017/cortexai
AUTH_SERVICE=http://localhost:8001
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

</details>

<details>
<summary><strong>frontend/.env</strong></summary>

```dotenv
VITE_SERVER_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

The Firebase web configuration lives in `frontend/utils/firebase.js`. If you use
your own Firebase project, update the project-specific values there as well.
Enable the Google provider in Firebase Authentication and add `localhost` to the
authorized domains for local development.

</details>

### 3. Start Redis

From the application directory:

```bash
cd backend
docker compose up -d
```

### 4. Run the services

Start each backend service in its own terminal, from the application directory:

```bash
# Terminal 1 — auth
cd backend/services/auth
npm run dev

# Terminal 2 — chat
cd backend/services/chat
npm run dev

# Terminal 3 — agent
cd backend/services/agent
npm run dev

# Terminal 4 — billing
cd backend/services/billing
npm run dev

# Terminal 5 — gateway
cd backend/gateway
npm run dev
```

Then start the frontend from the application directory:

```bash
cd frontend
npm run dev
```

Open **http://localhost:5173**, sign in with Google, and start a conversation.

| Service | Port |
| --- | ---: |
| Gateway | 8000 |
| Auth | 8001 |
| Chat | 8002 |
| Agent | 8003 |
| Billing | 8004 |
| Frontend (Vite) | 5173 |
| Redis | 6379 |

### Service scripts

| Location | `npm run dev` | `npm start` |
| --- | --- | --- |
| `backend/gateway` | nodemon | node |
| `backend/services/auth` | nodemon | node |
| `backend/services/chat` | nodemon | node |
| `backend/services/agent` | nodemon | node |
| `backend/services/billing` | nodemon | node |
| `frontend` | Vite dev server | — |

The frontend also supports `npm run build`, `npm run preview`, and `npm run lint`.

## Usage examples

| Prompt | Routed to |
| --- | --- |
| “Explain how transformer attention works.” | `chat` |
| “What happened in AI this week?” | `search` |
| “Build a responsive portfolio landing page.” | `coding` |
| “Create a presentation about renewable energy.” | `ppt` |
| “Write a PDF report on the history of the internet.” | `pdf` |
| “Generate a cinematic image of a city at night.” | `vision` |
| Attach a PDF and ask a question about it | `pdfRag` |
| Attach a screenshot and ask what it shows | `imageAnalyzer` |

Use the agent chips above the composer to override `Auto` routing. Attach a PDF
or image with the paperclip button; supported files are PDFs and images up to
**20 MB**.

## API reference

All routes below are exposed by the gateway at `http://localhost:8000`. Protected
routes require the `session` cookie set at login.

| Method | Endpoint | Auth | Description |
| --- | --- | :---: | --- |
| `POST` | `/api/auth/login` | No | Exchange a Firebase ID token (`{ "token": "..." }`) for a session cookie |
| `GET` | `/api/auth/logout` | No | Delete the session and clear the cookie |
| `GET` | `/api/me` | Yes | Return the current user from the Redis session |
| `POST` | `/api/agent/chat` | Yes | Run the agent workflow |
| `GET` | `/api/chat/create-conversation` | Yes | Create an empty conversation |
| `GET` | `/api/chat/get-conversations` | Yes | List the user's conversations, newest first |
| `POST` | `/api/chat/update-conversation` | Yes | Rename a conversation (`{ "id", "title" }`) |
| `GET` | `/api/chat/get-messages/:conversationId` | Yes | Load a conversation's messages |
| `POST` | `/api/billing/create` | Yes | Create a Razorpay order (`{ "plan": "starter" }`) |
| `POST` | `/api/billing/verify` | Yes | Verify the Razorpay signature and apply the plan |

### `POST /api/agent/chat`

Send `multipart/form-data` with:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `prompt` | string | Yes | The user's message |
| `conversationId` | string | Yes | Conversation ObjectId |
| `agent` | string | No | `auto` (default), `chat`, `search`, `coding`, `pdf`, `ppt`, `vision`, `pdfRag`, or `imageAnalyzer` |
| `file` | file | No | PDF or image, max 20 MB |

Example response:

```json
{
  "answer": "Here is the generated project...",
  "images": ["https://..."],
  "artifacts": [
    {
      "id": 1710000000000,
      "type": "Project",
      "title": "Build a landing page",
      "files": [
        { "name": "index.html", "content": "<!doctype html>..." },
        { "name": "style.css", "content": "..." },
        { "name": "script.js", "content": "..." }
      ]
    }
  ]
}
```

### Internal service endpoints

These are called service-to-service and are not intended for public clients:

- **Chat service** — `POST /save-message`,
  `GET /get-messages/:conversationId`
- **Auth service** — `POST /deduct-credits`, `POST /update-plan`

## Data and storage

| Store | Contents |
| --- | --- |
| MongoDB | Users, conversations, messages, payments |
| Redis | Sessions (7 days), chat-history cache (last 20 messages), per-minute rate-limit counters |
| Qdrant | Per-upload PDF vector collections (`pdf-<timestamp>`) |
| Supabase Storage | Generated PDFs, PPTX files, and images, served through time-limited signed URLs |
| Firebase | Google identity and ID-token verification |

## Credits and plans

Credits are stored on the user document. Each successful agent call deducts its
cost through the auth service; `credits` is the remaining balance and
`totalCredits` tracks the total allocated balance shown in the billing drawer.

| Plan | Price | Credits | Validity |
| --- | ---: | ---: | ---: |
| Free | ₹0 | 100 | — |
| Starter | ₹199 | 500 | 30 days |
| Pro | ₹499 | 1,000 | 30 days |

Billing flow: the client calls `POST /api/billing/create`, Razorpay Checkout
opens, and the client posts the payment result to `/api/billing/verify`. The
billing service recomputes the HMAC signature, marks the payment as paid, and
calls the auth service to update the user's plan and credits.

## Deployment

The deployment workflow is in `1.cortexAI/.github/workflows/deploy.yml`. It is
designed to run on pushes to `main` and does two things:

1. **Backend** — builds Docker images for the gateway and the four services,
   pushes them to Amazon ECR, and forces new ECS deployments.
2. **Frontend** — builds the Vite app, syncs `frontend/dist` to S3, and
   invalidates the CloudFront distribution.

> **Repository layout note:** GitHub Actions only reads workflows from
> `.github/workflows/` at the repository root, and this workflow's build paths
> assume `backend/` and `frontend/` are at the root. Here the app and workflow are
> nested under `1.cortexAI/`. Move the app to the repository root (or move the
> workflow and update its paths) before relying on CI.

Configure these repository secrets before enabling the workflow:

| Secret | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | ECR/ECS region |
| `AWS_ACCOUNT_ID` | ECR registry account |
| `ECS_CLUSTER` | ECS cluster name |
| `GATEWAY_SERVICE` | Gateway ECS service |
| `AUTH_SERVICE` | Auth ECS service |
| `CHAT_SERVICE` | Chat ECS service |
| `AGENT_SERVICE` | Agent ECS service |
| `BILLING_SERVICE` | Billing ECS service |
| `S3_BUCKET` | Frontend bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution |

Each backend Dockerfile uses the `backend` directory as its build context, so
the shared Redis client is included in every image.

### Production checklist

- Serve the app over HTTPS and set the session cookie to `secure: true`.
- Restrict gateway CORS to the production frontend origin.
- Store Firebase, Supabase, Qdrant, Razorpay, and model-provider credentials in a
  secrets manager rather than in `.env` files.
- Rotate the Supabase service role key and Razorpay secret if they were ever
  committed or shared.
- Point `REDIS_URL` at a persistent Redis instance and back up MongoDB.
- Configure a lifecycle policy for generated files and Qdrant collections.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `unauthorized` or `session expired` | Redis is not running, the cookie is missing, or the frontend is not sending credentials (`withCredentials: true`) |
| `Only PDF and Images are allowed` | The attachment is not a PDF or image |
| `Rate limit exceeded` | The per-minute agent limit was reached; wait for the retry window |
| Model or provider errors | Check the matching API key in `backend/services/agent/.env` |
| `Cannot find package 'ioredis'` | Install dependencies at `backend/` as well as in the service directory |
| PDF/image links stop working | Supabase signed URLs are time-limited; ask the agent to generate the file again |
| Payment verification fails | The Razorpay key secret or signature does not match the order |

## License

No license file is currently included. Add a `LICENSE` file if you plan to
distribute this project.

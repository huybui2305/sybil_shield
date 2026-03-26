# SybilShield 🛡️

**AI-Powered Sybil & Risk Engine for EVM Wallets.**

SybilShield uses the **OpenGradient TEE LLM** (Claude 3.5 Sonnet) and **Etherscan V2 API** to provide forensic on-chain risk analysis. It identifies Sybil attackers, bot networks, and low-quality airdrop farmers with high precision and cryptographic verifiability.

## 🚀 Features

- **Real-Time On-Chain Data:** Fetches transaction counts, ETH balances, and full transaction history via Etherscan V2.
- **Forensic AI Analysis:** Uses OpenGradient's Trusted Execution Environment (TEE) to ensure unbiased and private risk evaluation.
- **Sophisticated Heuristics:** Detects interaction with mixers (Tornado Cash), low-diversity protocol patterns, and script-like behavior.
- **Modern UI:** Built with Next.js 15, Tailwind CSS v4, and Framer Motion for a premium, high-tech experience.

## 🛠️ Tech Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS v4, Framer Motion, Lucide Icons.
- **Backend:** FastAPI, Python 3.12, httpx, OpenGradient SDK.
- **Infrastructure:** OpenGradient TEE Hub, Etherscan V2.

## 📦 Setup & Installation

### Backend
1. `cd backend`
2. `python -m venv venv`
3. `source venv/bin/activate` (or `.\venv\Scripts\activate` on Windows)
4. `pip install -r requirements.txt`
5. Create `.env` with `OG_PRIVATE_KEY` and `ETHERSCAN_API_KEY`.
6. `uvicorn main:app --reload`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## 🛡️ Security & Privacy
Analysis is performed inside a TEE (Trusted Execution Environment), ensuring that the model logic is tamper-proof and verifiably executed on the OpenGradient network.

## 📄 License
MIT

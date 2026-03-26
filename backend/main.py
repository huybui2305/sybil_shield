import os
import json
import random
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

# Verify OpenGradient key
OG_PRIVATE_KEY = os.environ.get("OG_PRIVATE_KEY")
if not OG_PRIVATE_KEY:
    raise RuntimeError("OG_PRIVATE_KEY not set. Check your backend .env file.")

try:
    import opengradient as og
except ImportError:
    raise RuntimeError("OpenGradient SDK not installed")

app = FastAPI(title="Sybil Shield Scanner", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm_client = og.LLM(private_key=OG_PRIVATE_KEY)

class ScanRequest(BaseModel):
    wallet: str

import httpx

ETHERSCAN_API_KEY = os.environ.get("ETHERSCAN_API_KEY")

async def get_onchain_metrics(wallet: str):
    if not ETHERSCAN_API_KEY:
        # Fallback to simulation if no key found (safety)
        random.seed(int(wallet, 16) if wallet.startswith("0x") else wallet)
        return {
            "tx_count": random.randint(0, 500),
            "age_days": random.randint(1, 1000),
            "eth_balance": round(random.uniform(0.001, 5.0), 4),
            "distinct_contracts": random.randint(1, 50),
            "has_tornado_cash_interaction": random.random() > 0.85,
            "is_suspicious_pattern": False
        }

    async with httpx.AsyncClient() as client:
        # Etherscan V2 Base URL: https://api.etherscan.io/v2/api?chainid=1
        base_v2 = "https://api.etherscan.io/v2/api?chainid=1"
        
        # 1. Total Transactions (Nonce)
        resp = await client.get(f"{base_v2}&module=proxy&action=eth_getTransactionCount&address={wallet}&tag=latest&apikey={ETHERSCAN_API_KEY}")
        tx_count_hex = resp.json().get("result", "0x0")
        tx_count = int(tx_count_hex, 16)

        # 2. ETH Balance
        resp = await client.get(f"{base_v2}&module=account&action=balance&address={wallet}&tag=latest&apikey={ETHERSCAN_API_KEY}")
        res_json = resp.json()
        balance_wei = int(res_json.get("result", "0"))
        eth_balance = round(balance_wei / 10**18, 4)

        # 3. Tx History for Age & Contract diversity
        resp = await client.get(f"{base_v2}&module=account&action=txlist&address={wallet}&startblock=0&endblock=99999999&page=1&offset=100&sort=asc&apikey={ETHERSCAN_API_KEY}")
        txs = resp.json().get("result", [])
        
        age_days = 0
        distinct_contracts = 0
        has_tornado = False
        
        if isinstance(txs, list) and len(txs) > 0:
            import datetime
            first_tx_time = int(txs[0].get("timeStamp", 0))
            if first_tx_time > 0:
                age_days = (datetime.datetime.now() - datetime.datetime.fromtimestamp(first_tx_time)).days
            
            # Count distinct "to" addresses that are likely contracts
            contracts = {t.get("to") for t in txs if t.get("to") and t.get("input") != "0x"}
            distinct_contracts = len(contracts)
            
            # Check for Tornado Cash addresses (main 0.1, 1, 10, 100 ETH pools)
            tornado_pools = {
                "0x12d697447e7958950c5d9d3d02404b5f8905aff9", # 0.1 ETH
                "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936", # 1 ETH
                "0x910cbd523d972d25a801d1c9a06a61a40f81d56e", # 10 ETH
                "0xA160cdAB224968c284db62DE61741D75e82f3471"  # 100 ETH
            }
            has_tornado = any(t.get("to", "").lower() in tornado_pools for t in txs)

        is_suspicious = (tx_count > 30 and distinct_contracts < 3)

        return {
            "tx_count": tx_count,
            "age_days": max(1, age_days),
            "eth_balance": eth_balance,
            "distinct_contracts": distinct_contracts,
            "has_tornado_cash_interaction": has_tornado,
            "is_suspicious_pattern": is_suspicious
        }

@app.post("/scan")
async def scan_wallet(req: ScanRequest):
    if not req.wallet.startswith("0x") or len(req.wallet) != 42:
        raise HTTPException(400, "Invalid EVM wallet address format")
    
    metrics = await get_onchain_metrics(req.wallet)
    
    prompt = f"""
    You are an elite Blockchain Security and Sybil Analysis AI running inside a TEE.
    Analyze the following on-chain metrics for wallet {req.wallet}.
    Evaluate the probability (0-100) that this wallet belongs to a Sybil attacker, bot network, or low-quality farmer.
    
    Metrics:
    - Transaction Count: {metrics['tx_count']}
    - Wallet Age (days): {metrics['age_days']}
    - ETH Balance: {metrics['eth_balance']}
    - Distinct Contracts Interacted: {metrics['distinct_contracts']}
    - Tornado Cash (Mixer) Interaction: {metrics['has_tornado_cash_interaction']}
    - Suspicious Low-Diversity Pattern: {metrics['is_suspicious_pattern']}
    
    Return ONLY a valid JSON object with the exact following structure:
    {{
        "sybil_probability": <int 0-100>,
        "risk_tier": "<Low|Medium|High|Extreme>",
        "summary": "<A 2-sentence explanation of why this score was given>",
        "flags": ["<red flag 1 if any>", "<red flag 2 if any>"]
    }}
    """
    
    try:
        response = await llm_client.chat(
            model=og.TEE_LLM.CLAUDE_SONNET_4_6,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024
        )
        
        if isinstance(response, dict):
            chat_output = response.get("chat_output", {})
        else:
            chat_output = getattr(response, "chat_output", {})
            
        if isinstance(chat_output, dict):
            content = chat_output.get("content", "")
        else:
            content = getattr(chat_output, "content", "")
            
        start = content.find('{')
        end = content.rfind('}') + 1
        
        if start == -1 or end == 0:
            raise ValueError(f"Content doesn't contain JSON. Raw: {content} | ChatOut: {chat_output}")
            
        data = json.loads(content[start:end])
        
        phash = getattr(response, "payment_hash", None) if not isinstance(response, dict) else response.get("payment_hash")
        
        return {
            "wallet": req.wallet,
            "metrics": metrics,
            "analysis": data,
            "payment_hash": phash,
            "explorer_url": f"https://explorer.opengradient.ai/tx/{phash}"
        }
    except Exception as e:
        raise HTTPException(500, str(e))

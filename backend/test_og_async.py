import os
import sys
import asyncio
from dotenv import load_dotenv
import opengradient as og

load_dotenv()

async def main():
    try:
        llm_client = og.LLM(private_key=os.environ.get("OG_PRIVATE_KEY"))
        print("created client")
        response = await llm_client.chat(
            model=og.TEE_LLM.CLAUDE_SONNET_4_6,
            messages=[{"role": "user", "content": "Return a valid JSON object: {'sybil_probability': 50, 'risk_tier': 'Medium', 'summary': 'test', 'flags': []}"}]
        )
        print("got response")
        print("DIR:", dir(response))
        print("VARS:", vars(response) if hasattr(response, '__dict__') else response)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())

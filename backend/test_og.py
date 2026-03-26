import os
from dotenv import load_dotenv
import opengradient as og

load_dotenv()
try:
    llm_client = og.LLM(private_key=os.environ.get("OG_PRIVATE_KEY"))
    response = llm_client.chat(
        model=og.TEE_LLM.CLAUDE_SONNET_4_6,
        messages=[{"role": "user", "content": "Return 'hello' in valid JSON: {'message': 'hello'}"}]
    )
    print("SUCCESS")
    print(response.choices[0].message.content)
except Exception as e:
    print("FAILED:", str(e))

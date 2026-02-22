# HuggingUI

ComfyUI-style node workflows built on `tldraw`, powered by Hugging Face Inference Providers and Spaces.

## What this app does

- Builds image and text pipelines on a node canvas.
- Runs inference through Hugging Face provider routing (`router.huggingface.co`).
- Supports Space-backed execution for model nodes configured as `Hugging Face Space`.
- Uses Hugging Face OAuth (Authorization Code + PKCE) for user auth.

## Setup

Create `.env.local`:

```bash
HF_OAUTH_CLIENT_ID=...
HF_OAUTH_CLIENT_SECRET=...
# Optional if your app URL is not auto-detectable:
# HF_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/huggingface/callback
# Optional scopes (defaults to: openid profile inference-api):
# HF_OAUTH_SCOPES=openid profile inference-api

# Optional server fallback token when not using browser OAuth sessions:
# HF_TOKEN=...

# Optional text model/provider overrides:
# HF_TEXT_MODEL=Qwen/Qwen2.5-72B-Instruct
# HF_TEXT_PROVIDER=auto

# Optional Space-backed advanced routes:
# HF_IP_ADAPTER_SPACE_ID=owner/space-name
# HF_IP_ADAPTER_SPACE_API_NAME=/predict
# HF_STYLE_TRANSFER_SPACE_ID=owner/space-name
# HF_STYLE_TRANSFER_SPACE_API_NAME=/predict
```

Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then sign in from the sidebar’s Hugging Face panel.

## Notes

- Model-node output now encodes Hugging Face provider/Space references, consumed by `/api/generate`.
- Space model mode supports JSON argument templating (default: `["{prompt}"]`).
- Existing local canvas data was versioned to a new persistence key (`huggingui-pipeline-v1`).
